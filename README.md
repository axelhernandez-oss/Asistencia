Sistema de Control de Asistencia Biométrico y Geográfico
Sistema corporativo de registro de asistencia diseñado para HH Transportes. Utiliza una interfaz web alojada en GitHub Pages para capturar identidad (foto) y ubicación (GPS), procesando los datos mediante Google Apps Script para su almacenamiento en Google Sheets.

Características Principales
Multi-Sede: Gestión independiente para Manzanillo, Veracruz, Queretaro, CDMX, Altamira

Validación de Geocerca (Geofencing): Bloqueo de registros si el empleado se encuentra fuera del rango permitido (300m - 1km).

Seguridad Biométrica: Captura obligatoria de fotografía para entrada y salida.

Prevención de Duplicados: Sistema inteligente que impide registrar doble entrada o doble salida en el mismo día.

Reportes Automatizados: Estructura optimizada para generar reportes quincenales (Lunes a Sábado).

Almacenamiento en Nube: Fotos guardadas automáticamente en carpetas específicas de Google Drive por sede.

Tecnologías Utilizadas
Frontend: HTML5, CSS3 (Diseño Corporativo), JavaScript (Vanilla).

Backend: Google Apps Script (V8 Engine).

Base de Datos: Google Sheets API.

Almacenamiento: Google Drive API.

Hosting: GitHub Pages.

Requisitos Previos
Google Spreadsheet: Un archivo con las pestañas de cada sede y sus respectivos históricos.

Google Drive: Carpetas creadas para cada sede para el almacenamiento de imágenes.

URL de Implementación: El script de Google debe estar publicado como "Aplicación Web" con acceso para "Cualquier persona".

Instalación y Configuración
1. Google Sheets
Configura tu hoja de cálculo con las siguientes columnas en las pestañas de Historico_[Sede]:
Fecha | ID | Nombre | Entrada | Salida | Latitud | Longitud | Foto Entrada | Foto Salida

2. Google Apps Script (Código.gs)
Copia el código del backend en el editor de scripts de tu hoja de cálculo.

Actualiza el objeto CARPETAS_SEDES con los IDs reales de tus carpetas de Drive.

Publica como Aplicación Web.

3. GitHub (index.html)
Sube el archivo index.html a tu repositorio.

Configura la constante WEB_APP_URL con la URL proporcionada por Google.

Ajusta las coordenadas en CONFIG_SEDES para cada ubicación.

Uso del Sistema
El acceso se realiza mediante una URL parametrizada (generalmente distribuida vía código QR):

Plaintext
https://tu-usuario.github.io/asistencia/?id=NUMERO_EMPLEADO&sede=NOMBRE_SEDE
El empleado abre el enlace desde su dispositivo móvil.

El sistema valida la ubicación GPS.

El empleado selecciona "Registrar Entrada" o "Registrar Salida".

Se captura la fotografía y se envía el registro al servidor.

Seguridad y Privacidad
HTTPS: Toda la comunicación entre el cliente y el servidor está cifrada vía SSL.

Validación de Servidor: El script verifica la existencia del ID en la base de datos maestra antes de procesar cualquier registro.

Acceso Restringido: El archivo de base de datos no es público; solo el script tiene permisos de lectura/escritura.

Reportes
Para generar el reporte quincenal, utiliza la pestaña de Reportes con la siguiente lógica de filtro:

Filtro por fechas (Inicio/Fin).

Exclusión de domingos automática.

Consolidación de sedes.

A continuacion se anexa el codigo para appscript 
----------------------------------------------------------------------------------------------------------------------------------------------------------------

    /**
     * Sistema de Gestión de Asistencia - HH Transportes
     * Backend: Google Apps Script
     */

    function doPost(e) {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
     var zonaHoraria = "GMT-6"; 

      // --- CONFIGURACIÓN DE CARPETAS ---
      // Reemplazar con los IDs de carpeta de Google Drive para cada sede
    var CARPETAS_SEDES = {
      "Sede_A": "ID_CARPETA_1",
    "Sede_B": "ID_CARPETA_2",
    "Sede_C": "ID_CARPETA_3"
        };

    try {
    var data = JSON.parse(e.postData.contents);
    var idEmpleado = data.id ? data.id.toString().trim() : "";
    var tipoRegistro = (data.tipo || "ENTRADA").toUpperCase();
    var sedeRecibida = data.sede || ""; 
    var lat = data.lat || "0";
    var lng = data.lng || "0";
    var base64Foto = data.foto;

    // 1. VALIDACIÓN DE SEDE Y ACCESO A HOJA
    var hojaSede = ss.getSheetByName(sedeRecibida);
    if (!hojaSede) return ContentService.createTextOutput("ERROR: SEDE NO ENCONTRADA");

    var nombreEmpleado = "";
    var existeID = false;
    var datosSede = hojaSede.getDataRange().getValues();
    
    // Búsqueda de ID en la columna C (índice 2)
    for (var i = 0; i < datosSede.length; i++) {
      if (datosSede[i][2].toString().trim() === idEmpleado) {
        nombreEmpleado = datosSede[i][0]; // Columna A
        existeID = true;
        break;
      }
    }

    if (!existeID) return ContentService.createTextOutput("ID_NO_AUTORIZADO");

    // 2. GESTIÓN DE HISTÓRICO POR SEDE
    var nombreH = "Historico_" + sedeRecibida;
    var hojaH = ss.getSheetByName(nombreH) || ss.insertSheet(nombreH);
    
    if (hojaH.getLastRow() === 0) {
      hojaH.appendRow(["Fecha", "ID", "Nombre", "Entrada", "Salida", "Latitud", "Longitud", "Foto Entrada", "Foto Salida"]);
    }

    // 3. LÓGICA DE PREVENCIÓN DE DUPLICADOS (Normalización de fecha)
    var ahora = new Date();
    var hoyTexto = Utilities.formatDate(ahora, zonaHoraria, "yyyy-MM-dd");
    var horaTexto = Utilities.formatDate(ahora, zonaHoraria, "HH:mm:ss");

    var registros = hojaH.getDataRange().getValues();
    var filaDestino = -1;
    var yaTieneEntrada = false;
    var yaTieneSalida = false;

    for (var j = 1; j < registros.length; j++) {
      if (registros[j][0] != "") {
        var fechaFila = Utilities.formatDate(new Date(registros[j][0]), zonaHoraria, "yyyy-MM-dd");
        if (registros[j][1].toString().trim() === idEmpleado && fechaFila === hoyTexto) {
          filaDestino = j + 1;
          if (registros[j][3] && registros[j][3].toString().length > 2) yaTieneEntrada = true;
          if (registros[j][4] && registros[j][4].toString().length > 2) yaTieneSalida = true;
          break;
        }
      }
    }

    if (tipoRegistro === "ENTRADA" && yaTieneEntrada) return ContentService.createTextOutput("YA_TIENE_ENTRADA");
    if (tipoRegistro === "SALIDA" && yaTieneSalida) return ContentService.createTextOutput("YA_TIENE_SALIDA");

    // 4. ALMACENAMIENTO DE IMAGEN EN DRIVE
    var carpetaId = CARPETAS_SEDES[sedeRecibida];
    var blob = Utilities.newBlob(Utilities.base64Decode(base64Foto.split(',')[1]), "image/png", idEmpleado + "_" + tipoRegistro + "_" + hoyTexto + ".png");
    var urlFoto = DriveApp.getFolderById(carpetaId).createFile(blob).getUrl();

    // 5. REGISTRO DE DATOS EN LA FILA CORRESPONDIENTE
    if (tipoRegistro === "ENTRADA") {
      if (filaDestino === -1) {
        hojaH.appendRow([ahora, idEmpleado, nombreEmpleado, horaTexto, "", lat, lng, urlFoto, ""]);
      } else {
        hojaH.getRange(filaDestino, 4).setValue(horaTexto);
        hojaH.getRange(filaDestino, 8).setValue(urlFoto);
      }
    } else {
      if (filaDestino !== -1) {
        hojaH.getRange(filaDestino, 5).setValue(horaTexto);
        hojaH.getRange(filaDestino, 9).setValue(urlFoto); 
      } else {
        hojaH.appendRow([ahora, idEmpleado, nombreEmpleado, "", horaTexto, lat, lng, "", urlFoto]);
      }
    }

    return ContentService.createTextOutput("OK");

    } catch (err) {
    return ContentService.createTextOutput("ERROR: " + err.toString());
  }
}

---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
