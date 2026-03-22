Sistema de Control de Asistencia Biométrico y Geográfico - HH Transportes
Descripción General
Sistema corporativo de registro de asistencia diseñado para la gestión de personal de HH Transportes. La solución utiliza una interfaz web alojada en GitHub Pages para la captura de identidad mediante fotografía y validación de coordenadas geográficas en tiempo real. El procesamiento y almacenamiento de datos se realiza de forma segura mediante Google Apps Script y Google Sheets.

Características Principales
Gestión Multi-Sede: Soporte independiente para las sedes de Manzanillo, Veracruz, Querétaro, CDMX, Altamira y entornos de Pruebas.

Seguridad por Token: Implementación de una clave de autenticación privada entre el cliente (GitHub) y el servidor (Google) para evitar registros no autorizados.

Validación de Geocerca (Geofencing): Bloqueo automático de la interfaz y la cámara si el dispositivo se encuentra fuera del radio permitido para cada sede.

Confirmación de Usuario: Doble validación mediante cuadros de diálogo para prevenir registros accidentales.

Limpieza de Parámetros URL: Una vez cargados los datos del empleado, el sistema limpia la barra de direcciones para proteger la privacidad de la información.

Ofuscación de Código: Lógica del lado del cliente protegida contra ingeniería inversa y acceso no autorizado a credenciales del sistema.

Almacenamiento Dinámico: Organización automática de evidencias fotográficas en Google Drive por Año y Mes.

Tecnologías Utilizadas
Frontend: HTML5, CSS3 (Bootstrap 5), JavaScript (Vanilla) con ofuscación de seguridad.

Backend: Google Apps Script (V8 Engine) expuesto como Web App.

Seguridad: Encriptación SSL/HTTPS, Validación de Token, Geolocation API.

Base de Datos: Google Sheets.

Almacenamiento: Google Drive API.

Requisitos de Configuración
1. Google Sheets
La hoja de cálculo debe contener pestañas nombradas por sede y sus respectivos históricos con la siguiente estructura de columnas:
Fecha | ID | Nombre | Entrada | Salida | Latitud | Longitud | Foto Entrada | Foto Salida | Estado | Sede | Clave_Entrada | Clave_Salida

2. Google Apps Script
Identificación de Carpetas: Actualizar el objeto CARPETAS_SEDES con los IDs reales de Google Drive.

Token de Seguridad: Configurar la variable TOKEN_SISTEMA con la misma clave utilizada en el frontend.

Publicación: Implementar como "Aplicación Web", ejecutar como "Yo" y acceso para "Cualquier persona".

3. GitHub Pages
Estructura de Archivos: index.html en la raíz y js/security_module.js (ofuscado).

Geolocalización: Configurar coordenadas exactas y radios de tolerancia en el objeto SEDES_CONFIG.

Instrucciones de Uso
El acceso se realiza mediante una URL parametrizada:
https://usuario.github.io/Asistencia/index.html?id=ID_EMPLEADO&sede=SEDE&nombre=NOMBRE_CON_GUIONES

El sistema solicita permisos de Ubicación.

Si la ubicación es válida, se activan los permisos de Cámara y se muestran los botones de registro.

Al seleccionar una acción, el sistema solicita una confirmación final.

Se genera el registro y se notifica el resultado en pantalla.

--------------------------------------------------------------------------------------------------------------------------

Backend: Código de Implementación (Google Apps Script)
JavaScript

    /**
        * Sistema de Gestión de Asistencia - HH Transportes
        * Backend consolidado con validación de Token y Concurrencia
     */
        
      function doPost(e) {
        var lock = LockService.getScriptLock();
      try {
    lock.waitLock(60000); // Control de concurrencia
    
    var data = JSON.parse(e.postData.contents);
    var zona = "GMT-6";
    
    // --- CAPA DE SEGURIDAD ---
    var TOKEN_SISTEMA = "Cambiar123*"; 
    if (data.token !== TOKEN_SISTEMA) {
      return ContentService.createTextOutput("ERROR: ACCESO_NO_AUTORIZADO").setMimeType(ContentService.MimeType.TEXT);
    }

    var idEmpleado = data.id ? data.id.toString().trim() : "";
    var tipoRegistro = (data.tipo || "ENTRADA").toUpperCase();
    var sedeRecibida = data.sede || ""; 
    var lat = data.lat || "0";
    var lng = data.lng || "0";
    var base64Foto = data.foto;

    // --- CONFIGURACIÓN DE CARPETAS RAÍZ DRIVE ---
    var CARPETAS_SEDES = {
      "Manzanillo": "ID_CARPETA_MANZANILLO",
      "Veracruz":   "ID_CARPETA_VERACRUZ",
      "CDMX":       "ID_CARPETA_CDMX",
      "Altamira":    "ID_CARPETA_ALTAMIRA",
      "Queretaro":   "ID_CARPETA_QUERETARO",
      "Pruebas":     "ID_CARPETA_PRUEBAS"
    };

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var hojaListaSede = ss.getSheetByName(sedeRecibida);
    if (!hojaListaSede) return ContentService.createTextOutput("ERROR: SEDE_INEXISTENTE");

    // Validación de Identidad
    var nombreEmpleado = "";
    var existeID = false;
    var datosLista = hojaListaSede.getDataRange().getValues();
    for (var i = 0; i < datosLista.length; i++) {
      if (datosLista[i][2].toString().trim() === idEmpleado) {
        nombreEmpleado = datosLista[i][0];
        existeID = true;
        break;
      }
    }
    if (!existeID) return ContentService.createTextOutput("ERROR: ID_NO_AUTORIZADO");

    // Preparar Hoja de Histórico
    var nombreH = "Historico_" + sedeRecibida;
    var hojaH = ss.getSheetByName(nombreH) || ss.insertSheet(nombreH);
    if (hojaH.getLastRow() === 0) {
      hojaH.appendRow(["Fecha", "ID", "Nombre", "Entrada", "Salida", "Latitud", "Longitud", "Foto Entrada", "Foto Salida", "Estado", "Sede", "Clave_Entrada", "Clave_Salida"]);
    }

    var ahora = new Date();
    var hoyTexto = Utilities.formatDate(ahora, zona, "yyyy-MM-dd");
    var horaTexto = Utilities.formatDate(ahora, zona, "HH:mm:ss");

    // Prevención de Duplicados vía Claves Únicas
    var claveEntrada = idEmpleado + "-" + hoyTexto + "-ENTRADA";
    var claveSalida = idEmpleado + "-" + hoyTexto + "-SALIDA";
    var registrosH = hojaH.getDataRange().getValues();
    
    for (var k = 0; k < registrosH.length; k++) {
      if (tipoRegistro === "ENTRADA" && registrosH[k][11] === claveEntrada) return ContentService.createTextOutput("YA_EXISTE_ENTRADA");
      if (tipoRegistro === "SALIDA" && registrosH[k][12] === claveSalida) return ContentService.createTextOutput("YA_EXISTE_SALIDA");
    }

    // Lógica de Carpeta Dinámica (Año/Mes)
    var carpetaPadre = DriveApp.getFolderById(CARPETAS_SEDES[sedeRecibida]);
    var anio = ahora.getFullYear().toString();
    var mes = ["01_Enero", "02_Febrero", "03_Marzo", "04_Abril", "05_Mayo", "06_Junio", "07_Julio", "08_Agosto", "09_Septiembre", "10_Octubre", "11_Noviembre", "12_Diciembre"][ahora.getMonth()];
    
    var fAnio = carpetaPadre.getFoldersByName(anio).hasNext() ? carpetaPadre.getFoldersByName(anio).next() : carpetaPadre.createFolder(anio);
    var fMes = fAnio.getFoldersByName(mes).hasNext() ? fAnio.getFoldersByName(mes).next() : fAnio.createFolder(mes);

    // Guardar Fotografía
    var blob = Utilities.newBlob(Utilities.base64Decode(base64Foto.split(',')[1]), "image/png", idEmpleado + "_" + tipoRegistro + "_" + hoyTexto + ".png");
    var urlFoto = fMes.createFile(blob).getUrl();

    // Registro Consolidado (Entrada y Salida en la misma fila)
    var filaDestino = -1;
    for (var j = 1; j < registrosH.length; j++) {
      var fechaFila = Utilities.formatDate(new Date(registrosH[j][0]), zona, "yyyy-MM-dd");
      if (registrosH[j][1].toString().trim() === idEmpleado && fechaFila === hoyTexto) {
        filaDestino = j + 1;
        break;
      }
    }

    if (tipoRegistro === "ENTRADA") {
      var estado = (ahora.getHours() > 8 || (ahora.getHours() === 8 && ahora.getMinutes() > 15)) ? "RETARDO" : "PUNTUAL";
      if (filaDestino === -1) {
        hojaH.appendRow([ahora, idEmpleado, nombreEmpleado, horaTexto, "", lat, lng, urlFoto, "", estado, sedeRecibida, claveEntrada, ""]);
      } else {
        hojaH.getRange(filaDestino, 4).setValue(horaTexto);
        hojaH.getRange(filaDestino, 8).setValue(urlFoto);
        hojaH.getRange(filaDestino, 10).setValue(estado);
        hojaH.getRange(filaDestino, 12).setValue(claveEntrada);
      }
    } else {
      if (filaDestino !== -1) {
        hojaH.getRange(filaDestino, 5).setValue(horaTexto);
        hojaH.getRange(filaDestino, 9).setValue(urlFoto);
        hojaH.getRange(filaDestino, 13).setValue(claveSalida);
      } else {
        hojaH.appendRow([ahora, idEmpleado, nombreEmpleado, "", horaTexto, lat, lng, "", urlFoto, "", sedeRecibida, "", claveSalida]);
      }
    }

    return ContentService.createTextOutput("OK");

      } catch (err) {
    return ContentService.createTextOutput("ERROR_SERVIDOR");
      } finally {
    lock.releaseLock();
      }    
    }
