// ═══════════════════════════════════════════════════════════════════
//  Smart Life Reminder — Google Apps Script Backend
//  File: Code.gs
//  Instructions: Paste this in Google Apps Script editor and deploy
//                as a Web App (Execute as: Me, Access: Anyone)
// ═══════════════════════════════════════════════════════════════════

// ── CONFIGURATION ──────────────────────────────────────────────────
// The script automatically uses the active spreadsheet.
// Make sure you run this from within your Google Sheet's Apps Script.

var SHEET_NAME = "Reminders"; // Name of the sheet tab
var HEADERS = ["ID", "Title", "Description", "Category", "Date", "Time", "Priority", "Status", "Created At"];

// ── ENTRY POINTS ───────────────────────────────────────────────────

/**
 * Handles GET requests — used for Restore (fetching reminders)
 * URL: ?action=restore
 */
function doGet(e) {
  try {
    var action = e && e.parameter && e.parameter.action ? e.parameter.action : "restore";

    if (action === "restore") {
      return handleRestore();
    }

    return jsonResponse({ success: false, error: "Unknown action: " + action });
  } catch (err) {
    return jsonResponse({ success: false, error: err.message });
  }
}

/**
 * Handles POST requests — used for Backup (saving reminders)
 * Body: JSON string with { action: "backup", reminders: [...] }
 */
function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var action = body.action || "backup";

    if (action === "backup") {
      return handleBackup(body.reminders || []);
    }

    return jsonResponse({ success: false, error: "Unknown action: " + action });
  } catch (err) {
    return jsonResponse({ success: false, error: "Parse error: " + err.message });
  }
}

// ── BACKUP HANDLER ─────────────────────────────────────────────────

/**
 * Saves all reminders to the Google Sheet.
 * Clears existing data (except headers) and writes fresh.
 */
function handleBackup(reminders) {
  var sheet = getOrCreateSheet();

  // Clear all data rows (keep headers)
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, HEADERS.length).clearContent();
  }

  if (reminders.length === 0) {
    return jsonResponse({ success: true, message: "No reminders to backup", count: 0 });
  }

  // Write all reminders
  var rows = reminders.map(function(r) {
    return [
      r.id || "",
      r.title || "",
      r.description || "",
      r.category || "",
      r.date || "",
      r.time || "",
      r.priority || "medium",
      r.status || "pending",
      r.createdAt || new Date().toISOString()
    ];
  });

  sheet.getRange(2, 1, rows.length, HEADERS.length).setValues(rows);

  // Auto-resize columns for readability
  try { sheet.autoResizeColumns(1, HEADERS.length); } catch(e) {}

  return jsonResponse({
    success: true,
    message: "Backup successful",
    count: reminders.length,
    timestamp: new Date().toISOString()
  });
}

// ── RESTORE HANDLER ────────────────────────────────────────────────

/**
 * Reads all reminders from the Google Sheet and returns JSON.
 */
function handleRestore() {
  var sheet = getOrCreateSheet();
  var lastRow = sheet.getLastRow();

  if (lastRow <= 1) {
    return jsonResponse({ success: true, reminders: [], message: "No reminders found in sheet" });
  }

  var data = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
  var reminders = [];

  data.forEach(function(row) {
    // Skip completely empty rows
    if (!row[0] && !row[1]) return;

    reminders.push({
      id: String(row[0] || ""),
      title: String(row[1] || ""),
      description: String(row[2] || ""),
      category: String(row[3] || "personal"),
      date: String(row[4] || ""),
      time: String(row[5] || ""),
      priority: String(row[6] || "medium"),
      status: String(row[7] || "pending"),
      createdAt: String(row[8] || new Date().toISOString()),
      notify: true
    });
  });

  return jsonResponse({
    success: true,
    reminders: reminders,
    count: reminders.length,
    timestamp: new Date().toISOString()
  });
}

// ── UTILITIES ──────────────────────────────────────────────────────

/**
 * Gets the Reminders sheet, or creates it with headers if missing.
 */
function getOrCreateSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    Logger.log("Created new sheet: " + SHEET_NAME);
  }

  // Ensure headers exist
  var firstRow = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  var hasHeaders = firstRow[0] === HEADERS[0];

  if (!hasHeaders) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);

    // Style the header row
    var headerRange = sheet.getRange(1, 1, 1, HEADERS.length);
    headerRange.setBackground("#4f8aff");
    headerRange.setFontColor("#ffffff");
    headerRange.setFontWeight("bold");
    headerRange.setFontSize(11);

    // Freeze header row
    sheet.setFrozenRows(1);

    Logger.log("Headers written to sheet");
  }

  return sheet;
}

/**
 * Returns a JSON ContentService response with CORS headers.
 */
function jsonResponse(data) {
  var output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

// ── TEST FUNCTION (Optional) ────────────────────────────────────────
// Run this manually in the Apps Script editor to test your setup.

function testSetup() {
  var sheet = getOrCreateSheet();
  Logger.log("Sheet name: " + sheet.getName());
  Logger.log("Headers OK: " + (sheet.getRange(1,1).getValue() === "ID"));

  // Test backup
  var testReminders = [
    {
      id: "test_" + Date.now(),
      title: "Test Reminder",
      description: "This is a test entry",
      category: "personal",
      date: "2025-01-01",
      time: "09:00",
      priority: "medium",
      status: "pending",
      createdAt: new Date().toISOString()
    }
  ];

  handleBackup(testReminders);
  Logger.log("Test backup complete — check your sheet!");

  // Test restore
  var restored = handleRestore();
  Logger.log("Restored: " + restored.getContent());
}
