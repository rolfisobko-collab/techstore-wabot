const { v2: cloudinary } = require("cloudinary");

let ready = false;

function initCloudinary() {
  cloudinary.config({
    cloud_name: "dxibpzcfy",
    api_key: "395575268427478",
    api_secret: "bbE8bMA7stCyME9srmYdw98m0sE",
  });
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
