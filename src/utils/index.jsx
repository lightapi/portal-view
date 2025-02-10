export {
  validateImageUrl,
  timeConversion,
  isJson,
  extractDomainFromEmail,
  stringToBoolean,
};

const validateImageUrl = (url) => {
  return new Promise(function (resolve, reject) {
    const img = new Image();
    img.onload = function () {
      resolve(url);
    };

    img.onerror = function () {
      reject("The url of image is invalid.");
    };

    img.src = url;
  });
};

const timeConversion = (millisec) => {
  var seconds = (millisec / 1000).toFixed(1);

  var minutes = (millisec / (1000 * 60)).toFixed(1);

  var hours = (millisec / (1000 * 60 * 60)).toFixed(1);

  var days = (millisec / (1000 * 60 * 60 * 24)).toFixed(1);

  if (seconds < 60) {
    return seconds + " S";
  } else if (minutes < 60) {
    return minutes + " M";
  } else if (hours < 24) {
    return hours + " H";
  } else {
    return days + " D";
  }
};

const isJson = (str) => {
  if (typeof str !== "string") return false;
  try {
    const result = JSON.parse(str);
    const type = Object.prototype.toString.call(result);
    return type === "[object Object]" || type === "[object Array]";
  } catch (err) {
    console.log(err);
    return false;
  }
};

const extractDomainFromEmail = (email) => {
  const parts = email.split("@");
  return parts[1];
};

const stringToBoolean = (str) => {
  // Remove any leading/trailing whitespace and get the first character in lowercase.
  const firstChar = str.trim().charAt(0).toLowerCase();
  // Return true if the first character is 'y' or 't', otherwise false.
  return firstChar === "y" || firstChar === "t";
};
