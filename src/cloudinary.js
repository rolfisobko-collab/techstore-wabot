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
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: "raw",
        public_id: "techstore/pricelist.pdf",
        overwrite: true,
      },
      (error, result) => {
        if (error) {
          console.error("[Cloudinary] Upload error:", error);
          return reject(error);
        }
        const finalUrl = result.secure_url || result.url;
        console.log("[Cloudinary] Uploaded:", finalUrl);
        if (!finalUrl) return reject(new Error("Cloudinary did not return a URL"));
        resolve({ url: finalUrl, fileName: originalName || "lista-precios.pdf" });
      }
    );
    stream.end(buffer);
  });
}

module.exports = { initCloudinary, uploadPdf };
