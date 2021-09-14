const Axios = require("axios");
const pThrottle = require("p-throttle");
const AWS = require("aws-sdk");
const fs = require("fs").promises;
const path = require("path");
const BUCKET_NAME = "chattes-gta-schools";
AWS.config.update({ region: "us-east-2" });

// Create S3 service object
s3 = new AWS.S3({ apiVersion: "2006-03-01" });

const start = async () => {
  console.log(process.env.args);
  try {
    const toronto = Axios({
      url: "https://www.scholarhood.ca/schools.json?region=tdsb",
      method: "get",
    });
    const toronto_catholic = Axios({
      url: "https://www.scholarhood.ca/schools.json?region=tcdsb",
      method: "get",
    });
    const durham_catholic = Axios({
      url: "https://www.scholarhood.ca/schools.json?region=dcdsb",
      method: "get",
    });
    const durham = Axios({
      url: "https://www.scholarhood.ca/schools.json?region=ddsb",
      method: "get",
    });
    const durham_peel = Axios({
      url: "https://www.scholarhood.ca/schools.json?region=dpcdsb",
      method: "get",
    });
    const halton_cath = Axios({
      url: "https://www.scholarhood.ca/schools.json?region=hcdsb",
      method: "get",
    });
    const halton = Axios({
      url: "https://www.scholarhood.ca/schools.json?region=hdsb",
      method: "get",
    });

    const peel = Axios({
      url: "https://www.scholarhood.ca/schools.json?region=pdsb",
      method: "get",
    });

    const york_cath = Axios({
      url: "https://www.scholarhood.ca/schools.json?region=ycdsb",
      method: "get",
    });

    const york = Axios({
      url: "https://www.scholarhood.ca/schools.json?region=yrdsb",
      method: "get",
    });
    const allSchools = await Promise.all([
      toronto,
      toronto_catholic,
      durham,
      durham_catholic,
      durham_peel,
      halton_cath,
      halton,
      peel,
      york,
      york_cath,
    ]);
    const gtaSchools = allSchools
      .reduce((acc, school) => {
        const schoolData = school.data;
        return [...acc, ...schoolData];
      }, [])
      .map((school) => {
        return (({
          url,
          id,
          name,
          type,
          is_catholic,
          language,
          level,
          city,
          city_slug,
          board,
          fraser_rating,
          eqao_rating,
        }) => ({
          url,
          id,
          name,
          type,
          is_catholic,
          language,
          level,
          city,
          city_slug,
          board,
          fraser_rating,
          eqao_rating,
        }))(school);
      });

    console.log("ALL:", gtaSchools.length);
    console.log(
      "Public",
      gtaSchools.filter((s) => s.is_catholic === false).length
    );
    console.log("Top::", gtaSchools.filter((s) => s.eqao_rating > 80).length);

    console.log("Getting Details...");

    const throttle = pThrottle({
      limit: 2,
      interval: 15000,
    });

    const throttled = throttle(async (school) => {
      details = await fetchDetails(school);
      return details;
    });

    let allSchoolDetails = [];

    for (let school of gtaSchools) {
      let det = await throttled(school);
      allSchoolDetails.push(det);
    }
    await fs.writeFile(
      path.join("allSchools.json"),
      JSON.stringify(allSchoolDetails),
      "utf-8"
    );

    console.log("File Saved");
    console.log("Uploading file to S3...");

    const fileContent = await fs.readFile(
      path.join("allSchools.json"),
      "utf-8"
    );
    const params = {
      Bucket: BUCKET_NAME,
      Key: "all-schools.json",
      Body: fileContent,
    };
    s3.upload(params, function (err, data) {
      if (err) {
        console.log("An error occured uploading file to S3", err);
        throw err;
      }
      console.log("All Done...");
    });
  } catch (error) {
    console.log("An error has occured", error);
  }
};

const fetchDetails = async (school) => {
  console.log("Fetching Details...", school.id);
  const details_url = `https://www.scholarhood.ca${school.url}.json`;
  let response;
  try {
    response = await Axios({
      url: details_url,
      method: "GET",
    });
  } catch (error) {
    console.log("An error has occured while fetching details for ", school.id);
    response = {
      data: {
        address: "",
        grades: "",
        website: "",
        phone_number: "",
        city: "",
        latitude: "",
        longitude: "",
      },
    };
  }

  let {
    address,
    grades,
    website,
    phone_number,
    city,
    latitude,
    longitude,
    ...rest
  } = response.data;

  const detail = {
    address,
    grades,
    website,
    phone_number,
    city,
    latitude,
    longitude,
  };

  const school_detail = { ...school, ...detail };

  return school_detail;
};

start();
