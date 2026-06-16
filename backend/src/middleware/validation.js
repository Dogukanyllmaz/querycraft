'use strict';

function validate(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) {
      const messages = error.details.map((d) => d.message).join('; ');
      return res.status(400).json({
        success: false,
        data: null,
        error: 'VALIDATION_ERROR',
        message: messages,
      });
    }
    req.body = value;
    next();
  };
}

module.exports = { validate };
