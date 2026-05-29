const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../utils/cloudinaryConfig");

// Configure Cloudinary storage for verification documents
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "taskero/verification-documents",
    allowed_formats: ["jpg", "jpeg", "png", "pdf", "webp"],
    transformation: [
      {
        width: 1200,
        height: 1200,
        crop: "limit",
        quality: "auto:good",
        format: "auto",
      },
    ],
    public_id: (req, file) => {
      // Generate unique public_id based on user ID, document type, and timestamp
      const userId = req.user?.id || req.params.userId || "unknown";
      const documentType = req.body.documentType || "document";
      const timestamp = Date.now();
      return `user-${userId}-${documentType
        .toLowerCase()
        .replace(/\s+/g, "-")}-${timestamp}`;
    },
  },
});

// File filter to validate document types
const fileFilter = (req, file, cb) => {
  // Allow images and PDFs for verification documents
  const allowedMimes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "application/pdf",
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Only image files (JPG, JPEG, PNG, WEBP) and PDF documents are allowed!"
      ),
      false
    );
  }
};

// Configure multer for verification documents
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit for documents
  },
});

// Middleware for multiple verification documents
const uploadVerificationDocuments = upload.fields([
  { name: "document", maxCount: 1 }, // Main document (ID, Passport, etc.)
  { name: "facePhoto", maxCount: 1 }, // Face photo for verification
  { name: "addressProof", maxCount: 1 }, // Address proof if needed
]);

// Middleware for single document upload
const uploadSingleDocument = upload.single("document");

module.exports = {
  uploadVerificationDocuments,
  uploadSingleDocument,
  upload,
};
