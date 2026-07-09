const CONFIG = {
    // Tu URL de Google Apps Script
    URL_API: "https://script.google.com/macros/s/AKfycby0xPIwIoBHs1SmGcPoXRLe7pLMTWJPHSu3y94mrYFkrNDxi2dEPrdH4Lc0BicJpHaMww/exec",
    // Tu Token de seguridad
    TOKEN: "Checador_nacional2026*"
};

// Coordenadas de las Sedes (Ajustadas a tus reportes anteriores)
const SEDES_CONFIG = {
  "Manzanillo": { lat: 21.075264, lng: -101.620855, radio: 300 },
  "Veracruz":   { lat: 19.173778, lng: -96.134222, radio: 300 },
  "CDMX":       { lat: 19.432608, lng: -99.133209, radio: 400 },
  "Altamira":    { lat: 22.395833, lng: -97.932778, radio: 300 },
  "Queretaro":   { lat: 20.588056, lng: -100.388056, radio: 300 },
  "Pruebas":     { lat: 21.0750924, lng: -101.6208135, radio: 1000 }
};

// 1. LÓGICA DE PERSISTENCIA (Soporte para F5 / Recarga)
const params = new URLSearchParams(window.location.search);
let idUser = params.get("id");
let nombreRaw = params.get("nombre");
let sedeUser = params.get("sede");

if (idUser && nombreRaw && sedeUser) {
    // Si entramos por link (QR), guardamos en memoria temporal de sesión
    sessionStorage.setItem('hht_id', idUser);
    sessionStorage.setItem('hht_nombre', nombreRaw.replace(/_/g, " "));
    sessionStorage.setItem('hht_sede', sedeUser);
    
    // Limpiamos la URL inmediatamente para proteger los datos
    window.history.replaceState({}, document.title, window.location.pathname);
} else {
    // Si es una recarga (F5), recuperamos de la sesión
    idUser = sessionStorage.getItem('hht_id');
    nombreRaw = sessionStorage.getItem('hht_nombre');
    sedeUser = sessionStorage.getItem('hht_sede');
}

// 2. VALIDACIÓN DE SESIÓN ACTIVA
if (!idUser || !nombreRaw || !sedeUser) {
    document.body.innerHTML = `
        <div style="text-align:center; padding:50px; font-family:sans-serif;">
            <h3 style="color:#d93025;">⚠️ Sesión No Válida</h3>
            <p>Por favor, escanea el código QR de nuevo para acceder al checador.</p>
        </div>`;
    throw new Error("No hay datos de sesión");
}

const nombreUser = nombreRaw; // Ya procesado

// Mostrar datos en pantalla
document.getElementById("displayNombre").innerText = nombreUser;
document.getElementById("displayID").innerText = idUser;
document.getElementById("displaySede").innerText = sedeUser;

const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const status = document.getElementById('status');
let latEnvio = "0", lngEnvio = "0";

// Función de Distancia
function getDistancia(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const p1 = lat1 * Math.PI/180, p2 = lat2 * Math.PI/180;
    const dP = (lat2-lat1) * Math.PI/180, dL = (lon2-lon1) * Math.PI/180;
    const a = Math.sin(dP/2)**2 + Math.cos(p1)*Math.cos(p2) * Math.sin(dL/2)**2;
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
}

// Iniciar GPS y Cámara
async function iniciarValidacion() {
    status.innerText = "📍 Verificando ubicación...";
    
    navigator.geolocation.getCurrentPosition(async (pos) => {
        latEnvio = pos.coords.latitude;
        lngEnvio = pos.coords.longitude;
        const sede = SEDES_CONFIG[sedeUser];

        if (!sede) {
            status.innerHTML = "<b class='text-danger'>ERROR: Sede no reconocida.</b>";
            return;
        }

        const dist = getDistancia(latEnvio, lngEnvio, sede.lat, sede.lng);

        if (dist > sede.radio) {
            status.innerHTML = `<b class='text-danger'>FUERA DE RANGO (${Math.round(dist)}m).</b>`;
            document.getElementById("btnEntrada").style.display = "none";
            document.getElementById("btnSalida").style.display = "none";
            video.style.display = "none";
        } else {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
                video.srcObject = stream;
                status.innerHTML = "<b class='text-success'>Ubicación validada ✅</b>";
            } catch (e) {
                status.innerText = "Error: Permiso de cámara denegado.";
            }
        }
    }, (err) => {
        status.innerText = "Error: Se requiere GPS activo.";
        alert("Es necesario activar el GPS para checar asistencia.");
    }, { enableHighAccuracy: true });
}

// Registro en Servidor
async function registrar(tipo) {
    status.innerText = "⏳ Enviando registro...";
    const btnE = document.getElementById("btnEntrada");
    const btnS = document.getElementById("btnSalida");
    btnE.disabled = true; btnS.disabled = true;

    const ctx = canvas.getContext('2d');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    
    const payload = {
        id: idUser, sede: sedeUser, nombre: nombreUser, tipo: tipo,
        foto: canvas.toDataURL('image/png'),
        token: CONFIG.TOKEN,
        lat: latEnvio, lng: lngEnvio
    };

    try {
        const res = await fetch(CONFIG.URL_API, { method: 'POST', body: JSON.stringify(payload) });
        const txt = await res.text();
        if (txt === "OK") {
            status.innerHTML = `<b class='text-success text-uppercase'>✅ Registro ${tipo} Exitoso</b>`;
            // Limpiar sesión tras éxito opcionalmente (recomendado)
            // sessionStorage.clear(); 
        } else {
            status.innerHTML = `<b class='text-danger'>❌ ${txt}</b>`;
        }
    } catch (e) { 
        status.innerText = "Error de red o servidor."; 
    } finally {
        btnE.disabled = false; btnS.disabled = false;
    }
}

// Función de Confirmación
function confirmarYRegistrar(tipo) {
    if (confirm(`Hola ${nombreUser}, ¿Confirmas tu registro de ${tipo.toLowerCase()}?`)) {
        registrar(tipo);
    }
}

document.getElementById("btnEntrada").onclick = () => confirmarYRegistrar("ENTRADA");
document.getElementById("btnSalida").onclick = () => confirmarYRegistrar("SALIDA");

iniciarValidacion();
