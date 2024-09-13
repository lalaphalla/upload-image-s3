const express = require("express");
const multer = require("multer");

// Connection to S3
const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} = require("@aws-sdk/client-s3");
const { Readable } = require("stream");
const { Upload } = require("@aws-sdk/lib-storage");
const sharp = require("sharp");
const dotenv = require("dotenv");

dotenv.config({ path: "./.env" });

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

const multerVideoFilter = (req, file, cb) => {
  // console.log(file);
  const filetypes = /.mp4|.avi|.mkv/;
  // const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  if (file.mimetype.startsWith("video")) {
    return cb(null, true);
  } else {
    cb("Error: Videos Only!");
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

const uploadVideo = multer({
  storage: multerStorage,
  fileFilter: multerVideoFilter,
  limits: { fileSize: 10000000 },
});

app.post("/upload", upload.single("photo"), async (req, res) => {
  req.file.filename = `user-profile-${Date.now()}.png`;
  // console.log(req.file);
  console.log(req.file.buffer);
  // const fileStream = Readable.from(req.file.buffer);

  const input = {
    // Bucket is the name of the bucket
    // Body is a file you get from sharp
    // Key is the name of the file
    Bucket: process.env.BUCKET_NAME,
    Body: req.file.buffer,
    Key: `customers/anb001/user_profile.png`,
  };

  try {
    const command = new PutObjectCommand(input);
    const response = await s3Client.send(command);

    // await upload.done();
    console.log("File uploaded");
    console.log(`path: ${req.file.filename}`);
    res.status(200).json({ message: "success", filename: req.file.filename });
  } catch (err) {
    res.status(500).json({ message: "failed", error: err });
  }
});
// route to get image
app.get("/images/:filename", async (req, res) => {
  const { filename } = req.params;
  try {
    const input = {
      Bucket: process.env.BUCKET_NAME,
      Key: filename,
    };
    const command = new GetObjectCommand(input);
    const data = await s3Client.send(command);

    // Set the correct Content-Type for the image (you can adjust this based on the file type)
    res.setHeader("Content-Type", "image/png");
    data.Body.pipe(res);
  } catch (err) {
    res.status(500).json({ message: "failed", error: err });
  }
});
// route delete file
app.delete("/images/:filename", async (req, res) => {
  const { filename } = req.params;
  try {
    const input = {
      Bucket: process.env.BUCKET_NAME,
      Key: filename,
    };
    const command = new DeleteObjectCommand(input);
    await s3Client.send(command);
    res.status(200).json({ message: "success" });
  } catch (err) {
    res.status(500).json({ message: "failed", error: err });
  }
});

async function multipleUploads(req, res) {
  // req.files.imageCover one file
  // req.files.images array
  console.log("object");
  const uploadPromises = req.files.images.map(async (file, idx) => {
    const input = {
      Bucket: process.env.BUCKET_NAME,
      Body: file.buffer,
      Key: `products/p003/product-img-${idx + 1}.png`,
      ContentType: "image/png", // This ensures the file is displayed in the browser
    };
    // console.log(input);
    await s3Client.send(new PutObjectCommand(input));
  });
  // await Promise.all(uploadPromises);
  // console.log(req.file);
}
//upload multiple image
app.post(
  "/upload-product",
  upload.fields([
    { name: "imageCover", maxCount: 1 },
    { name: "images", maxCount: 4 },
  ]),
  async (req, res) => {
    try {
      const input = {
        Bucket: process.env.BUCKET_NAME,
        Body: req.files.imageCover[0].buffer,
        Key: `products/p003/cover.jpg`,
        ContentType: "image/png", // This ensures the file is displayed in the browser
      };
      await s3Client.send(new PutObjectCommand(input));
      // console.log(input);
      // await s3Client.send(new PutObjectCommand(input));
      await multipleUploads(req, res);
      // console.log('multiple');
      // const upload = new Upload({
      //   client: s3Client,
      //   params: {
      //     Bucket: "pmp2024",
      //     Key: req.files.imageCover.filename,
      //     Body: req.files.imageCover.buffer, // Use the buffer here
      //   },
      // });
      // const uploadPromises = req.files.images.map((file) => {
      //   const fileStream = file.buffer;
      //   const params = {
      //     Bucket: "pmp2024",
      //     Key: file.originalname + Date.now(),
      //     Body: fileStream,
      //   };

      //   const upload = new Upload({
      //     client: s3Client,
      //     params,
      //   });

      //   return upload.done();
      // });

      // await Promise.all(uploadPromises);

      // res.status(200).json("File uploaded");
      res.status(200).json({ message: "success" });
    } catch (err) {
      res.status(500).json({ message: "failed", error: err.message });
    }
  }
);

// route upload video
app.post("/videos", uploadVideo.single("video"), async (req, res) => {
  req.file.fieldname = `video-${Date.now()}.mp4`;
  console.log(req.file.mimetype);
  const input = {
    Bucket: process.env.BUCKET_NAME,
    Body: req.file.buffer,
    Key: req.file.fieldname,
  };
  console.log(input);
  try {
    const command = new PutObjectCommand(input);
    await s3Client.send(command);
    res.status(200).json({ message: "success", filename: req.file.fieldname });
  } catch (err) {
    res.status(500).json({ message: "failed", error: err });
  }
});
// route to get video
app.get("/videos/:filename", async (req, res) => {
  const { filename } = req.params;
  try {
    const input = {
      Bucket: process.env.BUCKET_NAME,
      Key: filename,
    };
    const command = new GetObjectCommand(input);
    const data = await s3Client.send(command);
    res.setHeader("Content-Type", "video/mp4");
    data.Body.pipe(res);
  } catch (err) {
    res.status(500).json({ message: "failed", error: err });
  }
});
//route uplaod multiple videos
app.post(
  "/multiple-video",
  uploadVideo.fields([{ name: "lectures", maxCount: 50 }]),
  async (req, res) => {
    try {
      const uploadPromises = req.files.lectures.map(async (file, idex) => {
        const input = {
          Bucket: process.env.BUCKET_NAME,
          Body: file.buffer,
          Key: `courses/c001/lectures/lecture-${idex + 1}.mp4`, //req.file.fieldname,
        };
        await s3Client.send(new PutObjectCommand(input));
      });

      await Promise.all(uploadPromises);
      res.status(200).json({ message: "success" });
    } catch (err) {}
  }
);
app.listen(3001, () => console.log("listening port 3001"));
