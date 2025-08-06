const { body } = require("express-validator");

const alphaErr = "must only contain letters.";
const lengthErr = "must be between 1 and 15 characters.";

const validatePasswordOnly = [
  body("password")
    .isLength({ min: 8 }).withMessage("Password must be at least 8 characters")
    .matches(/[A-Z]/).withMessage("Password must contain at least one uppercase letter")
    .matches(/[a-z]/).withMessage("Password must contain at least one lowercase letter")
    .matches(/[0-9]/).withMessage("Password must contain at least one number")
    .matches(/[@$!%*?&#]/).withMessage("Password must contain at least one special character"),

  body("confPassword")
    .custom((value, { req }) => value === req.body.password)
    .withMessage("Passwords do not match"),
];

const validateUser = [
  body("firstname").trim()
    .isAlpha().withMessage(`First name ${alphaErr}`)
    .isLength({ min: 1, max: 15 }).withMessage(`First name ${lengthErr}`),

  body("lastname").trim()
    .isAlpha().withMessage(`Last name ${alphaErr}`)
    .isLength({ min: 1, max: 15 }).withMessage(`Last name ${lengthErr}`),

  body("username").trim()
    .isLength({ min: 6 }).withMessage("Username must be at least 6 characters"),

  body("password").trim()
    .isLength({ min: 8 }).withMessage("Password must be at least 8 characters")
    .matches(/[A-Z]/).withMessage("Password must contain at least one uppercase letter")
    .matches(/[a-z]/).withMessage("Password must contain at least one lowercase letter")
    .matches(/[0-9]/).withMessage("Password must contain at least one number")
    .matches(/[@$!%*?&#]/).withMessage("Password must contain at least one special character"),

    body("email")
    .optional({ checkFalsy: true }) // ✅ skips empty strings AND undefined
    .isEmail().withMessage("Invalid email address"),
  ];

module.exports = { validateUser, validatePasswordOnly };