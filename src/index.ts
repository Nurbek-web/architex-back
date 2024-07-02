import "dotenv/config";
import express from "express";
import multer from "multer";
import AWS from "aws-sdk";
import globalRouter from "./global-router";
import { logger } from "./logger";
import Replicate from "replicate";

const app = express();
const PORT = process.env.PORT || 3000;

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.use(logger);
app.use(express.json());
app.use("/api/v1/", globalRouter);

app.post(
  "/upload-exterior",
  upload.single("image"),
  async (req: any, res: express.Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const { prompt } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: "Prompt is required" });
      }

      const params = {
        Bucket: process.env.S3_BUCKET_NAME!,
        Key: `uploads/${Date.now()}_${req.file.originalname}`,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
      };

      const s3Data = await s3.upload(params).promise();
      const imageUrl = s3Data.Location;

      const output = await replicate.run(
        "jagilley/controlnet-hough:854e8727697a057c525cdb45ab037f64ecca770a1769cc52287c2e56472a247b",
        {
          input: {
            image: imageUrl,
            eta: 0,
            scale: 9,
            a_prompt: "best quality, extremely detailed",
            n_prompt:
              "longbody, lowres, bad anatomy, bad hands, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality",
            ddim_steps: 20,
            num_samples: "1",
            value_threshold: 0.1,
            image_resolution: "512",
            detect_resolution: 512,
            distance_threshold: 0.1,
            prompt: prompt, // Use prompt from request body
          },
        }
      );

      res.status(200).json(output);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Something went wrong" });
    }
  }
);

app.listen(PORT, () => {
  console.log(`Server runs at http://localhost:${PORT}`);
});
