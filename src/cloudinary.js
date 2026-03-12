const { v2: cloudinary } = require("cloudinary");

let ready = false;

function initCloudinary() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    console.warn("[Cloudinary] Credentials not set — PDF upload will be disabled");
    return;
  }

  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
  ready = true;
  console.log("[Cloudinary] Ready ✅");
}

async function uploadPdf(buffer, originalName) {
  if (!ready) throw new Error("Cloudinary not configured");

  return new Promise((resolve, reject) => {
    const filename = `pricelist_${Date.now()}`;
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: "raw",
        public_id: `techstore/pdfs/${filename}`,
        format: "pdf",
        overwrite: true,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve({ url: result.secure_url, fileName: originalName || "lista-precios.pdf" });
      }
    );
    stream.end(buffer);
  });
}

module.exports = { initCloudinary, uploadPdf };
