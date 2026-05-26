import express from "express";
const router = express.Router();

router.get("/config", (req, res) => {
  res.json({
    navHomeLabel: process.env.NAV_HOME_LABEL || "Forms",
    navHomeIcon: process.env.NAV_HOME_ICON || "home",
    defaultLanguage: process.env.DEFAULT_LANGUAGE || "en"
  });
});

export default router;