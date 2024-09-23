const express = require("express");
const multer = require("multer");
const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");
const { PassThrough } = require("stream");
const path = require("path");

const { Readable } = require("stream");
const { Upload } = require("@aws-sdk/lib-storage");
const sharp = require("sharp");
const dotenv = require("dotenv");

// Connection to S3
const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListBucketsCommand,
} = require("@aws-sdk/client-s3");

dotenv.config({ path: "./.env" });

const app = express();

// Backblaze B2 Credentials
// Create an S3 client using the Backblaze endpoint
// const s3Client = new S3Client({
//   endpoint: "https://s3.us-west-002.backblazeb2.com",
//   region: "us-west-004",
//   credentials: {
//     accessKeyId: process.env.BACKBLAZE_ACCESS_KEY,
//     secretAccessKey: process.env.BACKBLAZE_SECRET_KEY,
//   },
// });

// AWS S3
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

//image will storage in a buffer
const multerStorage = multer.memoryStorage();
const multerDiskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const ext = file.mimetype.split("/")[1];
    cb(null, `user-profile-${Date.now()}.${ext}`);
  },
});

const upload = multer({
  storage: multerStorage,
  fileFilter: multerFilter,
});

const uploadVideo = multer({
  storage: multerStorage,
  fileFilter: multerVideoFilter,
  limits: {
    fileSize: 200 * 1024 * 1024, // 50MB limit
  },
});
const copyVideo = multer({
  storage: multerDiskStorage,
  fileFilter: multerVideoFilter,
  limits: {
    fileSize: 200 * 1024 * 1024, // 50MB limit
  },
});

app.post("/upload", upload.single("photo"), async (req, res) => {
  async function listBuckets() {
    try {
      const response = await s3Client.send(new ListBucketsCommand({}));
      console.log("Buckets:", response.Buckets);
    } catch (error) {
      console.error("Error listing buckets:", error);
    }
  }

  listBuckets();

  // req.file.filename = `user-profile-${Date.now()}.png`;
  // console.log(req.file);
  console.log(req.file.buffer);
  // const fileStream = Readable.from(req.file.buffer);
  req.file.filename = `customers/anb001/user_profile.png`;
  const input = {
    // Bucket is the name of the bucket
    // Body is a file you get from sharp
    // Key is the name of the file
    Bucket: process.env.BUCKET_NAME,
    Body: req.file.buffer,
    Key: req.file.filename,
  };

  console.log(input);
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

      // res.status(200).json("File uploaded");
      res.status(200).json({ message: "success" });
    } catch (err) {
      res.status(500).json({ message: "failed", error: err.message });
    }
  }
);

const compressVideo2 = (inputPath, outputPath, res) => {
  console.log("object", inputPath, outputPath);
  ffmpeg(inputPath)
    .output(path.join(__dirname, "uploads", outputPath))
    .videoCodec("libx264")
    .size("60%")
    .on("end", () => {
      console.log("Compression completed!");
      // res.send("Video uploaded and compressed successfully!");
    })
    .on("error", (err) => {
      console.error("Compression failed:", err);
      res.status(500).send("Compression failed.");
    })
    .run();
};
// Compress video using FFmpeg
const compressVideo = (inputBuffer, outputPath) => {
  console.log(inputBuffer);
  return new Promise((resolve, reject) => {
    const outputStream = fs.createWriteStream(outputPath);
    const inputStream = Readable.from(inputBuffer); // Create a readable stream from the buffer

    // Compress the video
    ffmpeg()
      .input(inputStream)
      .inputFormat("mp4")
      .videoCodec("libx264") // Use x264 codec for compression
      .size("640x?") // Resize video (optional)
      .on("end", () => {
        console.log("Compression finished");
        resolve(outputPath);
      })
      .on("error", (err) => {
        reject(err);
      })
      .pipe(outputStream, { end: true });
  });
};

// Compress video using FFmpeg and return a stream
const compressVideoToStream = (inputBuffer) => {
  const passThroughStream = new PassThrough();

  // Compress the video and pipe the result to the PassThrough stream
  console.log(inputBuffer);
  ffmpeg()
    .input(inputBuffer)
    .videoCodec("libx264") // Use x264 codec for compression
    .size("640x?") // Resize video (optional)
    .on("error", (err) => {
      console.error("Compression error: ", err);
      passThroughStream.end(); // End stream on error
    })
    .on("end", () => {
      console.log("Compression finished");
      passThroughStream.end();
    })
    .pipe(passThroughStream);

  return passThroughStream;
};
app.post("/compress", copyVideo.single("video"), async (req, res) => {
  const videoPath = req.file.path;
  const outputFilePath = `compressed_${req.file.originalname}`;
  compressVideo2(videoPath, outputFilePath, res);
  req.file.fieldname = `video-${Date.now()}.mp4`;
  console.log(req.file.mimetype);
  try {
    res.status(200).json({ message: "success", filename: req.file.fieldname });
  } catch (err) {
    res.status(500).json({ message: "failed", error: err });
  }
});
// route upload video
app.post("/videos", uploadVideo.single("video"), async (req, res) => {
  // const compressedVideoStream = compressVideoToStream(req.file.buffer);
  console.log(req.file);
  const videoPath = req.file.path;
  // const outputFilePath = `compressed_${req.file.originalname}`;

  // await uploadToS3(compressedVideoStream, `compressed-${Date.now()}.mp4`);

  // await compressVideo(req.file.buffer, `video-${Date.now()}.mp4`);
  // compressVideo2(videoPath, outputFilePath, res);

  req.file.fieldname = `video-${Date.now()}.mp4`;
  console.log(req.file.mimetype);
  const input = {
    Bucket: process.env.BUCKET_NAME,
    Body: req.file.buffer,
    Key: "courses/c001/lecture01/" + req.file.fieldname,
    ContentType: "video/mp4",
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
      Key: "courses/c001/lectures/" + filename,
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
          ContentType: "video/mp4",
        };
        await s3Client.send(new PutObjectCommand(input));
      });

      await Promise.all(uploadPromises);
      res.status(200).json({ message: "success" });
    } catch (err) {}
  }
);
app.listen(3001, () => console.log("listening port 3001"));
