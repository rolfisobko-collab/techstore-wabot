# TechStore — WhatsApp Welcome Bot

Bot de WhatsApp para TechStore. Envía automáticamente un mensaje de bienvenida + PDF de lista de precios a cada persona que escribe, con cooldown de 3 horas por número.

## Estructura del proyecto

```
techstore-wabot/
├── index.js              # Punto de entrada
├── src/
│   ├── config.js         # Configuración por defecto
│   ├── configLoader.js   # Lee/escribe config en Firestore
│   ├── whatsapp.js       # Lógica de WhatsApp (baileys) — 3 instancias
│   ├── api.js            # API REST + sirve el panel
│   ├── firebase.js       # Firestore: cooldown y datos de clientes
│   └── cloudinary.js     # Subida de PDF a Cloudinary
├── panel/                # Frontend React (panel de administración)
├── nixpacks.toml         # Config de build para Koyeb
├── Procfile              # web: node index.js
└── package.json
```

## Funcionalidades

- Soporta **3 números de WhatsApp** simultáneos
- Envía mensaje de bienvenida + PDF en cada primer contacto (cooldown 3hs)
- Guarda datos del cliente en **Firestore** (nombre, teléfono, instancia, primer contacto, total mensajes)
- PDF almacenado en **Cloudinary** (persiste entre deploys)
- Configuración (mensaje, nombre negocio) guardada en **Firestore**
- Panel web para conectar números (QR), editar mensaje y subir PDF

## Ejecutar localmente

```bash
npm install
node index.js
# Panel en http://localhost:8000
```

## Despliegue en Koyeb

1. Crear servicio desde GitHub → repo `techstore-wabot`
2. **Builder**: Nixpacks
3. **Build command**: `npm install && npm run build`
4. **Run command**: `node index.js`
5. **Port**: `8000`
6. Deploy

## Servicios externos (sin tarjeta de crédito)

- **Firebase Firestore** — [console.firebase.google.com](https://console.firebase.google.com) — proyecto `techstore-d12a3`
- **Cloudinary** — [cloudinary.com](https://cloudinary.com) — cloud `dxibpzcfy`
