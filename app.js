const express = require("express");
const multer = require("multer");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { Readable } = require("stream");
const { Upload } = require("@aws-sdk/lib-storage");
const sharp = require("sharp");
const dotenv = require('dotenv');

dotenv.config({ path: './.env' });

const app = express();

const s3Client = new S3Client({
  region: process.env.YOUR_AWS_REGION,
  credentials: {
    accessKeyId: process.env.YOUR_ACCESS_KEY,
    secretAccessKey: process.env.YOUR_SECRET_ACCESS_KEY,
  },
});

// const multerStorage = multer.memoryStorage();
const multerFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image")) {
    cb(null, true);
  } else {
    cb("Please upload only images", false);
  }
};
// const multerStroage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, "uploads/");
//   },
//   filename: (req, file, cb) => {
//     const ext = file.mimetype.split("/")[1];
//     cb(null, `user-${Date.now()}.${ext}`);
//   },
// });
//image will storage in a buffer
const multerStorage = multer.memoryStorage();

// const upload = multer({ dest: "uploads/" });
// const upload = multer({ storage: multerStorage, fileFilter: multerFilter });
const upload = multer({
  storage: multerStorage,
  fileFilter: multerFilter,
});

app.post("/upload", upload.single("photo"), async (req, res) => {


  req.file.filename = `user-${Date.now()}.png`;
  // console.log(req.file);
  console.log(req.file.buffer);
  // const fileStream = Readable.from(req.file.buffer);

  const input = {
    // Bucket is the name of the bucket
    // Body is a file you get from sharp
    // Key is the name of the file
  	Bucket: 'agteach-assets',
  	Body: req.file.buffer,
  	Key: req.file.originalname,
  }
  // const upload = new Upload({
  //   client: s3Client, 
  //   params: {
  //     Bucket: "pmp2024",
  //     Key: req.file.filename,
  //     Body: fileStream, // Use the buffer here
  //   },
  // });
  try {
    const command = new PutObjectCommand(input);
    const response = await s3Client.send(command);

    // await upload.done();
    console.log("File uploaded");
    res.status(200).json({ message: "success", filename: req.file.filename });
  } catch (err) {
    res.status(500).json({ message: "failed", error: err });
  }
});

app.post(
  "/upload-multiple",
  upload.fields([
    { name: "imageCover", maxCount: 1 },
    { name: "images", maxCount: 3 },
  ]),
  async (req, res) => {
    try {
      const upload = new Upload({
        client: s3Client,
        params: {
          Bucket: "pmp2024",
          Key: req.files.imageCover.filename,
          Body: req.files.imageCover.buffer, // Use the buffer here
        },
      });
      const uploadPromises = req.files.images.map((file) => {
        const fileStream = file.buffer;
        const params = {
          Bucket: "pmp2024",
          Key: file.originalname + Date.now(),
          Body: fileStream,
        };

        const upload = new Upload({
          client: s3Client,
          params,
        });

        return upload.done();
      });

      await Promise.all(uploadPromises);
      res.status(200).json("File uploaded");
    } catch (err) {
      res.status(500).json({ message: "failed", error: err.message });
    }
  }
);

app.listen(3000, () => console.log("listening port 3000"));
