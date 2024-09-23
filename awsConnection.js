
const dotenv = require("dotenv");

const { S3Client } = require("@aws-sdk/client-s3");

const s3Client = new S3Client({
  region: process.env.YOUR_AWS_REGION,
  credentials: {
    accessKeyId: process.env.YOUR_ACCESS_KEY,
    secretAccessKey: process.env.YOUR_SECRET_ACCESS_KEY,
  },
});


module.exports =  s3Client 