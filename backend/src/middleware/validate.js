const { httpError } = require("../utils/httpError");

function validate(schema) {
  return (req, _res, next) => {
    const parsed = schema.safeParse({
      body: req.body,
      params: req.params,
      query: req.query
    });
    if (!parsed.success) {
      return next(httpError(400, "Invalid request", parsed.error.flatten()));
    }
    req.validated = parsed.data;
    next();
  };
}

module.exports = { validate };
