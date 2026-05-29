const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../utils/cloudinaryConfig");

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "taskero/gigs",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [
      {
        width: 1200,
        height: 900,
        crop: "limit",
        quality: "auto:good",
        format: "auto",
      },
    ],
    public_id: (req, file) => {
      const gigId = req.params.id || "new";
      const timestamp = Date.now();
      const random = Math.floor(Math.random() * 10000);
      return `gig-${gigId}-${timestamp}-${random}`;
    },
  },
});

const fileFilter = (req, file, cb) => {
  const allowedMimes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only image files (JPG, JPEG, PNG, WEBP) are allowed!"), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 8 * 1024 * 1024, // 8MB per image
  },
});

// Accept up to 5 images under the field name "images"
const uploadGigImages = upload.array("images", 5);

module.exports = { uploadGigImages };
