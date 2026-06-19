'use strict';

const nodemailer = require('nodemailer');
const { getSetting } = require('./settingsService');

function getSmtpConfig() {
  return {
    enabled: getSetting('smtp_enabled') === 'true',
    host:    getSetting('smtp_host'),
    port:    parseInt(getSetting('smtp_port') || '587', 10),
    user:    getSetting('smtp_user'),
    pass:    getSetting('smtp_pass'),
    from:    getSetting('smtp_from') || 'noreply@querycraft.local',
  };
}

function createTransporter(cfg) {
  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.port === 465,
    auth: cfg.user ? { user: cfg.user, pass: cfg.pass } : undefined,
  });
}

async function sendPasswordReset(toEmail, resetUrl) {
  const cfg = getSmtpConfig();

  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
      <h2 style="color:#1e293b">Şifre Sıfırlama</h2>
      <p>Aşağıdaki bağlantıya tıklayarak şifrenizi sıfırlayabilirsiniz.</p>
      <p style="margin:24px 0">
        <a href="${resetUrl}"
           style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block">
          Şifremi Sıfırla
        </a>
      </p>
      <p style="color:#64748b;font-size:13px">Bu bağlantı <strong>1 saat</strong> geçerlidir. Eğer bu isteği siz yapmadıysanız bu e-postayı görmezden gelin.</p>
    </div>`;

  if (!cfg.enabled) {
    console.log('\n──────────────────────────────────────────');
    console.log('📧  [emailService] DEV MODE — e-posta gönderilmedi');
    console.log(`    To:  ${toEmail}`);
    console.log(`    URL: ${resetUrl}`);
    console.log('──────────────────────────────────────────\n');
    return;
  }

  const transport = createTransporter(cfg);
  await transport.sendMail({
    from: cfg.from,
    to:   toEmail,
    subject: 'QueryCraft — Şifre Sıfırlama',
    html,
  });
}

async function sendWelcome(toEmail, displayName, tempPassword) {
  const cfg = getSmtpConfig();

  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
      <h2 style="color:#1e293b">QueryCraft'a Hoş Geldiniz</h2>
      <p>Merhaba ${displayName || toEmail}, hesabınız oluşturuldu.</p>
      <ul style="background:#f1f5f9;padding:16px 24px;border-radius:8px;list-style:none">
        <li><strong>E-posta:</strong> ${toEmail}</li>
        ${tempPassword ? `<li><strong>Geçici şifre:</strong> <code>${tempPassword}</code></li>` : ''}
      </ul>
      ${tempPassword ? '<p style="color:#64748b;font-size:13px">İlk girişinizden sonra şifrenizi değiştirmenizi öneririz.</p>' : ''}
    </div>`;

  if (!cfg.enabled) {
    console.log('\n──────────────────────────────────────────');
    console.log('📧  [emailService] DEV MODE — hoş geldin maili');
    console.log(`    To: ${toEmail} | Pass: ${tempPassword || '(none)'}`);
    console.log('──────────────────────────────────────────\n');
    return;
  }

  const transport = createTransporter(cfg);
  await transport.sendMail({
    from: cfg.from,
    to:   toEmail,
    subject: 'QueryCraft — Hesabınız Oluşturuldu',
    html,
  });
}

async function testSmtp() {
  const cfg = getSmtpConfig();
  if (!cfg.host) throw new Error('SMTP sunucu adresi yapılandırılmamış');

  const transport = createTransporter(cfg);
  await transport.verify();
  return { ok: true, host: cfg.host, port: cfg.port };
}

module.exports = { sendPasswordReset, sendWelcome, testSmtp };
