const appJson = require('./app.json');

module.exports = ({ config }) => {
  return {
    ...appJson.expo,
    extra: {
      ...appJson.expo.extra,
      googleClientId: process.env.GOOGLE_CLIENT_ID,
    },
  };
};
