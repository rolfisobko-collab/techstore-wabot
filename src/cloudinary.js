const { v2: cloudinary } = require("cloudinary");
const fs = require("fs");
const os = require("os");
const path = require("path");

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

  const tmpPath = path.join(os.tmpdir(), `pricelist_${Date.now()}.pdf`);
  try {
    fs.writeFileSync(tmpPath, buffer);
    const result = await cloudinary.uploader.upload_large(tmpPath, {
      resource_type: "raw",
      public_id: `techstore/pdfs/pricelist`,
      format: "pdf",
      overwrite: true,
      chunk_size: 6 * 1024 * 1024,
    });
    return { url: result.secure_url, fileName: originalName || "lista-precios.pdf" };
  } finally {
    try { fs.unlinkSync(tmpPath); } catch {}
  }
}

module.exports = { initCloudinary, uploadPdf };
