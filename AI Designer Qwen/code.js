// Qwen UI Composer — PROMPT-AWARE EDITION
// code.js
// ----------------------------------------------------
// Без backend'а. Весь "інтелект" — усередині плагіна.
// Ти пишеш промпт → плагін аналізує текст → збирає
// професійний dashboard із готових патернів.
// ----------------------------------------------------

// ======================
// 1. Базові константи
// ======================

var PLUGIN_NAME = "Qwen UI Composer";
var LAYOUT_VERSION = "4.0.0-prompt-local";

var DEVICE_PRESETS = {
  desktop: { width: 1440 },
  mobile: { width: 390 }
};

var DEFAULT_DEVICE = "desktop";
var DEFAULT_THEME_ID = "dark";

var MAX_LAYOUT_NODES = 1200;

var generationState = {
  isRunning: false
};

var PLUGIN_DATA_KEYS = {
  layoutVersion: "qwen-layout-version",
  layoutName: "qwen-layout-name",
  device: "qwen-layout-device",
  theme: "qwen-layout-theme",
  source: "qwen-layout-source",
  promptPreview: "qwen-layout-prompt-preview"
};

// ======================
// 2. Теми (tokens)
// ======================

var THEME_TOKENS = {
  dark: {
    id: "dark",
    name: "Dark",
    background: { r: 0.05, g: 0.06, b: 0.10 },
    surface: { r: 0.11, g: 0.12, b: 0.14 },
    surfaceAlt: { r: 0.16, g: 0.17, b: 0.21 },
    accent: { r: 0.34, g: 0.62, b: 1.00 },
    accentSoft: { r: 0.23, g: 0.36, b: 0.60 },
    borderSubtle: { r: 0.20, g: 0.22, b: 0.26 },
    textPrimary: { r: 0.98, g: 0.99, b: 1.00 },
    textSecondary: { r: 0.70, g: 0.72, b: 0.79 },
    textMuted: { r: 0.52, g: 0.55, b: 0.63 },
    success: { r: 0.23, g: 0.73, b: 0.42 },
    danger: { r: 0.93, g: 0.30, b: 0.36 },
    warning: { r: 0.95, g: 0.71, b: 0.37 },
    radiusLg: 12,
    radiusMd: 10,
    radiusSm: 8,
    radiusPill: 999,
    paddingLg: 24,
    paddingMd: 16,
    paddingSm: 12,
    gapLg: 24,
    gapMd: 16,
    gapSm: 8,
    fontFamily: "Inter",
    fontSizeTitle: 18,
    fontSizeBody: 13,
    fontSizeCaption: 11
  },
  light: {
    id: "light",
    name: "Light",
    background: { r: 0.96, g: 0.97, b: 0.99 },
    surface: { r: 1.00, g: 1.00, b: 1.00 },
    surfaceAlt: { r: 0.94, g: 0.95, b: 0.98 },
    accent: { r: 0.19, g: 0.42, b: 0.96 },
    accentSoft: { r: 0.73, g: 0.82, b: 1.00 },
    borderSubtle: { r: 0.85, g: 0.88, b: 0.93 },
    textPrimary: { r: 0.08, g: 0.10, b: 0.18 },
    textSecondary: { r: 0.30, g: 0.34, b: 0.44 },
    textMuted: { r: 0.54, g: 0.57, b: 0.66 },
    success: { r: 0.24, g: 0.65, b: 0.36 },
    danger: { r: 0.85, g: 0.27, b: 0.29 },
    warning: { r: 0.94, g: 0.67, b: 0.26 },
    radiusLg: 12,
    radiusMd: 10,
    radiusSm: 8,
    radiusPill: 999,
    paddingLg: 24,
    paddingMd: 16,
    paddingSm: 12,
    gapLg: 24,
    gapMd: 16,
    gapSm: 8,
    fontFamily: "Inter",
    fontSizeTitle: 18,
    fontSizeBody: 13,
    fontSizeCaption: 11
  }
};

// ======================
// 3. Утиліти
// ======================

function solidPaintFromColor(color, opacity) {
  var o = typeof opacity === "number" ? opacity : 1;
  return {
    type: "SOLID",
    visible: true,
    opacity: o,
    color: { r: color.r, g: color.g, b: color.b }
  };
}

function safeSetFills(node, paints) {
  try {
    if ("fills" in node) node.fills = paints;
  } catch (e) {}
}

function safeSetStrokes(node, strokes) {
  try {
    if ("strokes" in node) node.strokes = strokes;
  } catch (e) {}
}

function safeSetEffects(node, effects) {
  try {
    if ("effects" in node) node.effects = effects;
  } catch (e) {}
}

function safeResize(node, width, height) {
  try {
    if (typeof node.resizeWithoutConstraints === "function") {
      node.resizeWithoutConstraints(width, height);
    } else if (typeof node.resize === "function") {
      node.resize(width, height);
    }
  } catch (e) {}
}

function safeNotify(message, options) {
  try {
    figma.notify(message, options || {});
  } catch (e) {}
}

function getTheme(themeId) {
  if (!themeId || !THEME_TOKENS[themeId]) return THEME_TOKENS[DEFAULT_THEME_ID];
  return THEME_TOKENS[themeId];
}

function getDevicePreset(deviceId) {
  if (!deviceId || !DEVICE_PRESETS[deviceId]) return DEVICE_PRESETS[DEFAULT_DEVICE];
  return DEVICE_PRESETS[deviceId];
}

function setPluginMetadata(node, metadata) {
  if (!node || !metadata) return;
  for (var key in metadata) {
    if (Object.prototype.hasOwnProperty.call(metadata, key)) {
      try {
        node.setPluginData(key, String(metadata[key]));
      } catch (e) {}
    }
  }
}

function countNodesUnder(node, limit) {
  if (!node || !("children" in node)) return 0;
  var stack = [node];
  var count = 0;
  while (stack.length > 0) {
    var current = stack.pop();
    if (!current || !("children" in current)) continue;
    var children = current.children;
    for (var i = 0; i < children.length; i++) {
      count++;
      if (count > limit) return count;
      if ("children" in children[i] && children[i].children && children[i].children.length > 0) {
        stack.push(children[i]);
      }
    }
  }
  return count;
}

// ======================
// 4. Текст і шрифти
// ======================

function applyTextStyle(node, theme, sizeType, weightType) {
  if (!node) return;

  var fontSize = theme.fontSizeBody;
  if (sizeType === "title") fontSize = theme.fontSizeTitle;
  if (sizeType === "caption") fontSize = theme.fontSizeCaption;

  var fontName = { family: theme.fontFamily, style: "Regular" };
  if (weightType === "medium") fontName.style = "Medium";
  if (weightType === "semibold") fontName.style = "Semi Bold";
  if (weightType === "bold") fontName.style = "Bold";

  try { node.fontSize = fontSize; } catch (e1) {}
  try { node.fontName = fontName; } catch (e2) {
    try { node.fontName = { family: theme.fontFamily, style: "Regular" }; } catch (e3) {}
  }
}

function createTextNode(text, theme, sizeType, weightType, colorType) {
  var node = figma.createText();
  node.characters = text;

  applyTextStyle(node, theme, sizeType, weightType);

  var color = theme.textPrimary;
  if (colorType === "secondary") color = theme.textSecondary;
  if (colorType === "muted") color = theme.textMuted;
  if (colorType === "accent") color = theme.accent;
  if (colorType === "success") color = theme.success;
  if (colorType === "danger") color = theme.danger;

  safeSetFills(node, [solidPaintFromColor(color)]);
  return node;
}

function loadFontsForTheme(theme) {
  var fonts = [
    { family: theme.fontFamily, style: "Regular" },
    { family: theme.fontFamily, style: "Medium" },
    { family: theme.fontFamily, style: "Semi Bold" },
    { family: theme.fontFamily, style: "Bold" }
  ];
  var promises = [];
  for (var i = 0; i < fonts.length; i++) {
    promises.push(figma.loadFontAsync(fonts[i]).catch(function () { return null; }));
  }
  return Promise.all(promises);
}

// ======================
// 5. Компонентні патерни
// ======================

function createBaseCardFrame(name, theme, isVertical) {
  var frame = figma.createFrame();
  frame.name = name;
  frame.layoutMode = isVertical ? "VERTICAL" : "HORIZONTAL";
  frame.primaryAxisSizingMode = "AUTO";
  frame.counterAxisSizingMode = "AUTO";
  frame.primaryAxisAlignItems = "MIN";
  frame.counterAxisAlignItems = "MIN"; // тільки MIN | CENTER | MAX | BASELINE
  frame.itemSpacing = theme.gapSm;
  frame.paddingTop = theme.paddingMd;
  frame.paddingRight = theme.paddingMd;
  frame.paddingBottom = theme.paddingMd;
  frame.paddingLeft = theme.paddingMd;
  safeSetFills(frame, [solidPaintFromColor(theme.surface)]);
  safeSetStrokes(frame, [{
    type: "SOLID",
    visible: true,
    color: theme.borderSubtle,
    opacity: 1
  }]);
  safeSetEffects(frame, [{
    type: "DROP_SHADOW",
    radius: 18,
    offset: { x: 0, y: 8 },
    color: { r: 0, g: 0, b: 0, a: 0.18 },
    visible: true,
    spread: 0,
    blendMode: "NORMAL"
  }]);
  frame.cornerRadius = theme.radiusLg;
  return frame;
}

// Navbar
function createNavbar(theme, titleText, subtitleText) {
  var frame = createBaseCardFrame("Navbar", theme, false);
  frame.layoutMode = "HORIZONTAL";
  frame.counterAxisAlignItems = "CENTER";
  frame.itemSpacing = theme.gapLg;
  frame.paddingTop = 16;
  frame.paddingBottom = 16;
  safeSetEffects(frame, []);

  var left = figma.createFrame();
  left.name = "Left";
  left.layoutMode = "HORIZONTAL";
  left.primaryAxisSizingMode = "AUTO";
  left.counterAxisSizingMode = "AUTO";
  left.primaryAxisAlignItems = "MIN";
  left.counterAxisAlignItems = "CENTER";
  left.itemSpacing = theme.gapSm;
  left.paddingTop = 0;
  left.paddingRight = 0;
  left.paddingBottom = 0;
  left.paddingLeft = 0;
  safeSetFills(left, []);
  safeSetStrokes(left, []);

  var logo = figma.createEllipse();
  logo.name = "Logo";
  safeResize(logo, 24, 24);
  safeSetFills(logo, [solidPaintFromColor(theme.accent)]);
  safeSetStrokes(logo, []);

  var titleGroup = figma.createFrame();
  titleGroup.name = "Title group";
  titleGroup.layoutMode = "VERTICAL";
  titleGroup.primaryAxisSizingMode = "AUTO";
  titleGroup.counterAxisSizingMode = "AUTO";
  titleGroup.primaryAxisAlignItems = "MIN";
  titleGroup.counterAxisAlignItems = "MIN";
  titleGroup.itemSpacing = 2;
  titleGroup.paddingTop = 0;
  titleGroup.paddingRight = 0;
  titleGroup.paddingBottom = 0;
  titleGroup.paddingLeft = 0;
  safeSetFills(titleGroup, []);
  safeSetStrokes(titleGroup, []);

  var title = createTextNode(titleText, theme, "body", "semibold", "primary");
  var subtitle = createTextNode(subtitleText, theme, "caption", "regular", "muted");
  titleGroup.appendChild(title);
  titleGroup.appendChild(subtitle);

  left.appendChild(logo);
  left.appendChild(titleGroup);

  var right = figma.createFrame();
  right.name = "Right";
  right.layoutMode = "HORIZONTAL";
  right.primaryAxisSizingMode = "AUTO";
  right.counterAxisSizingMode = "AUTO";
  right.primaryAxisAlignItems = "MIN";
  right.counterAxisAlignItems = "CENTER";
  right.itemSpacing = theme.gapMd;
  right.paddingTop = 0;
  right.paddingRight = 0;
  right.paddingBottom = 0;
  right.paddingLeft = 0;
  safeSetFills(right, []);
  safeSetStrokes(right, []);

  var period = createTextNode("Last 30 days", theme, "body", "medium", "secondary");
  right.appendChild(period);

  frame.appendChild(left);
  frame.appendChild(right);
  return frame;
}

// KPI row
function createKpiRow(theme, items) {
  var row = figma.createFrame();
  row.name = "KPI Row";
  row.layoutMode = "HORIZONTAL";
  row.primaryAxisSizingMode = "AUTO";
  row.counterAxisSizingMode = "AUTO";
  row.primaryAxisAlignItems = "MIN";
  row.counterAxisAlignItems = "CENTER"; // було STRETCH → тепер валідно
  row.itemSpacing = theme.gapMd;
  row.paddingTop = 0;
  row.paddingRight = 0;
  row.paddingBottom = 0;
  row.paddingLeft = 0;
  safeSetFills(row, []);
  safeSetStrokes(row, []);

  for (var i = 0; i < items.length; i++) {
    var card = createBaseCardFrame("Metric / " + items[i].label, theme, true);
    card.itemSpacing = 8;

    var label = createTextNode(items[i].label, theme, "caption", "medium", "muted");
    var value = createTextNode(items[i].value, theme, "title", "semibold", "primary");
    card.appendChild(label);
    card.appendChild(value);

    if (items[i].hint) {
      var hint = createTextNode(items[i].hint, theme, "caption", "regular", "muted");
      card.appendChild(hint);
    }

    row.appendChild(card);
  }

  return row;
}

// Filter row
function createFilterRow(theme, filters) {
  var row = figma.createFrame();
  row.name = "Filters";
  row.layoutMode = "HORIZONTAL";
  row.primaryAxisSizingMode = "AUTO";
  row.counterAxisSizingMode = "AUTO";
  row.primaryAxisAlignItems = "MIN";
  row.counterAxisAlignItems = "CENTER";
  row.itemSpacing = theme.gapSm;
  row.paddingTop = 0;
  row.paddingRight = 0;
  row.paddingBottom = 0;
  row.paddingLeft = 0;
  safeSetFills(row, []);
  safeSetStrokes(row, []);

  for (var i = 0; i < filters.length; i++) {
    var pill = figma.createFrame();
    pill.name = "Filter / " + filters[i];
    pill.layoutMode = "HORIZONTAL";
    pill.primaryAxisSizingMode = "AUTO";
    pill.counterAxisSizingMode = "AUTO";
    pill.primaryAxisAlignItems = "MIN";
    pill.counterAxisAlignItems = "CENTER";
    pill.itemSpacing = 6;
    pill.paddingTop = 4;
    pill.paddingRight = 10;
    pill.paddingBottom = 4;
    pill.paddingLeft = 10;
    pill.cornerRadius = theme.radiusPill;
    safeSetFills(pill, [solidPaintFromColor(theme.surfaceAlt)]);
    safeSetStrokes(pill, []);

    var label = createTextNode(filters[i], theme, "caption", "medium", "secondary");
    pill.appendChild(label);

    row.appendChild(pill);
  }

  return row;
}

// Chart card
function createChartCard(theme, titleText, subtitleText) {
  var card = createBaseCardFrame("Chart / " + titleText, theme, true);
  card.itemSpacing = theme.gapSm;

  var header = figma.createFrame();
  header.name = "Header";
  header.layoutMode = "VERTICAL";
  header.primaryAxisSizingMode = "AUTO";
  header.counterAxisSizingMode = "AUTO";
  header.primaryAxisAlignItems = "MIN";
  header.counterAxisAlignItems = "MIN";
  header.itemSpacing = 2;
  header.paddingTop = 0;
  header.paddingRight = 0;
  header.paddingBottom = 0;
  header.paddingLeft = 0;
  safeSetFills(header, []);
  safeSetStrokes(header, []);

  header.appendChild(createTextNode(titleText, theme, "body", "medium", "primary"));
  if (subtitleText) {
    header.appendChild(createTextNode(subtitleText, theme, "caption", "regular", "muted"));
  }

  var canvas = figma.createRectangle();
  canvas.name = "Chart Canvas";
  safeResize(canvas, 560, 220);
  safeSetFills(canvas, [solidPaintFromColor(theme.surfaceAlt)]);
  safeSetStrokes(canvas, []);
  canvas.cornerRadius = theme.radiusMd;

  var xAxis = figma.createFrame();
  xAxis.name = "X Axis";
  xAxis.layoutMode = "HORIZONTAL";
  xAxis.primaryAxisSizingMode = "AUTO";
  xAxis.counterAxisSizingMode = "AUTO";
  xAxis.primaryAxisAlignItems = "MIN";
  xAxis.counterAxisAlignItems = "CENTER";
  xAxis.itemSpacing = theme.gapSm;
  xAxis.paddingTop = 8;
  xAxis.paddingRight = 0;
  xAxis.paddingBottom = 0;
  xAxis.paddingLeft = 0;
  safeSetFills(xAxis, []);
  safeSetStrokes(xAxis, []);

  var labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  for (var i = 0; i < labels.length; i++) {
    xAxis.appendChild(createTextNode(labels[i], theme, "caption", "regular", "muted"));
  }

  card.appendChild(header);
  card.appendChild(canvas);
  card.appendChild(xAxis);

  return card;
}

// Table card
function createTableCard(theme, titleText, subtitleText, columns, rows) {
  var card = createBaseCardFrame("Table / " + titleText, theme, true);
  card.itemSpacing = theme.gapSm;

  var header = figma.createFrame();
  header.name = "Header";
  header.layoutMode = "VERTICAL";
  header.primaryAxisSizingMode = "AUTO";
  header.counterAxisSizingMode = "AUTO";
  header.primaryAxisAlignItems = "MIN";
  header.counterAxisAlignItems = "MIN";
  header.itemSpacing = 2;
  header.paddingTop = 0;
  header.paddingRight = 0;
  header.paddingBottom = 0;
  header.paddingLeft = 0;
  safeSetFills(header, []);
  safeSetStrokes(header, []);

  header.appendChild(createTextNode(titleText, theme, "body", "medium", "primary"));
  if (subtitleText) {
    header.appendChild(createTextNode(subtitleText, theme, "caption", "regular", "muted"));
  }

  var headerRow = figma.createFrame();
  headerRow.name = "Header row";
  headerRow.layoutMode = "HORIZONTAL";
  headerRow.primaryAxisSizingMode = "AUTO";
  headerRow.counterAxisSizingMode = "AUTO";
  headerRow.primaryAxisAlignItems = "MIN";
  headerRow.counterAxisAlignItems = "CENTER";
  headerRow.itemSpacing = 16;
  headerRow.paddingTop = 0;
  headerRow.paddingRight = 0;
  headerRow.paddingBottom = 0;
  headerRow.paddingLeft = 0;
  safeSetFills(headerRow, []);
  safeSetStrokes(headerRow, []);

  for (var i = 0; i < columns.length; i++) {
    headerRow.appendChild(createTextNode(columns[i], theme, "caption", "medium", "secondary"));
  }

  var body = figma.createFrame();
  body.name = "Rows";
  body.layoutMode = "VERTICAL";
  body.primaryAxisSizingMode = "AUTO";
  body.counterAxisSizingMode = "AUTO";
  body.primaryAxisAlignItems = "MIN";
  body.counterAxisAlignItems = "MIN";
  body.itemSpacing = 6;
  body.paddingTop = 4;
  body.paddingRight = 0;
  body.paddingBottom = 0;
  body.paddingLeft = 0;
  safeSetFills(body, []);
  safeSetStrokes(body, []);

  for (var r = 0; r < rows.length; r++) {
    var rowFrame = figma.createFrame();
    rowFrame.name = "Row " + (r + 1);
    rowFrame.layoutMode = "HORIZONTAL";
    rowFrame.primaryAxisSizingMode = "AUTO";
    rowFrame.counterAxisSizingMode = "AUTO";
    rowFrame.primaryAxisAlignItems = "MIN";
    rowFrame.counterAxisAlignItems = "CENTER";
    rowFrame.itemSpacing = 16;
    rowFrame.paddingTop = 3;
    rowFrame.paddingRight = 0;
    rowFrame.paddingBottom = 3;
    rowFrame.paddingLeft = 0;
    safeSetFills(rowFrame, []);
    safeSetStrokes(rowFrame, []);

    for (var c = 0; c < columns.length; c++) {
      var cellText = rows[r][c] || "";
      rowFrame.appendChild(createTextNode(cellText, theme, "caption", "regular", "secondary"));
    }

    body.appendChild(rowFrame);
  }

  card.appendChild(header);
  card.appendChild(headerRow);
  card.appendChild(body);

  return card;
}

// Insights card
function createInsightsCard(theme, titleText, subtitleText, items) {
  var card = createBaseCardFrame("Insights / " + titleText, theme, true);
  card.itemSpacing = theme.gapSm;

  var header = figma.createFrame();
  header.name = "Header";
  header.layoutMode = "VERTICAL";
  header.primaryAxisSizingMode = "AUTO";
  header.counterAxisSizingMode = "AUTO";
  header.primaryAxisAlignItems = "MIN";
  header.counterAxisAlignItems = "MIN";
  header.itemSpacing = 2;
  header.paddingTop = 0;
  header.paddingRight = 0;
  header.paddingBottom = 0;
  header.paddingLeft = 0;
  safeSetFills(header, []);
  safeSetStrokes(header, []);
  header.appendChild(createTextNode(titleText, theme, "body", "medium", "primary"));
  if (subtitleText) {
    header.appendChild(createTextNode(subtitleText, theme, "caption", "regular", "muted"));
  }

  var list = figma.createFrame();
  list.name = "List";
  list.layoutMode = "VERTICAL";
  list.primaryAxisSizingMode = "AUTO";
  list.counterAxisSizingMode = "AUTO";
  list.primaryAxisAlignItems = "MIN";
  list.counterAxisAlignItems = "MIN";
  list.itemSpacing = 6;
  list.paddingTop = 4;
  list.paddingRight = 0;
  list.paddingBottom = 0;
  list.paddingLeft = 0;
  safeSetFills(list, []);
  safeSetStrokes(list, []);

  for (var i = 0; i < items.length; i++) {
    var row = figma.createFrame();
    row.name = "Insight " + (i + 1);
    row.layoutMode = "HORIZONTAL";
    row.primaryAxisSizingMode = "AUTO";
    row.counterAxisSizingMode = "AUTO";
    row.primaryAxisAlignItems = "MIN";
    row.counterAxisAlignItems = "CENTER";
    row.itemSpacing = 6;
    row.paddingTop = 0;
    row.paddingRight = 0;
    row.paddingBottom = 0;
    row.paddingLeft = 0;
    safeSetFills(row, []);
    safeSetStrokes(row, []);

    var bullet = figma.createEllipse();
    safeResize(bullet, 6, 6);
    safeSetFills(bullet, [solidPaintFromColor(theme.accent)]);
    safeSetStrokes(bullet, []);

    var text = createTextNode(items[i], theme, "caption", "regular", "secondary");

    row.appendChild(bullet);
    row.appendChild(text);
    list.appendChild(row);
  }

  card.appendChild(header);
  card.appendChild(list);
  return card;
}

// Notes / generic card
function createNotesCard(theme, titleText, subtitleText, bodyText) {
  var card = createBaseCardFrame("Notes / " + titleText, theme, true);
  card.itemSpacing = theme.gapSm;

  card.appendChild(createTextNode(titleText, theme, "body", "medium", "primary"));
  if (subtitleText) {
    card.appendChild(createTextNode(subtitleText, theme, "caption", "regular", "muted"));
  }
  if (bodyText) {
    card.appendChild(createTextNode(bodyText, theme, "body", "regular", "secondary"));
  }

  return card;
}

// ======================
// 6. Prompt → layoutSpec
// ======================

function analyzePrompt(prompt, deviceId) {
  var text = (prompt || "").toLowerCase();
  var device = deviceId || "desktop";

  var domain = "generic";
  if (text.indexOf("marketing") !== -1 || text.indexOf("маркетинг") !== -1) domain = "marketing";
  else if (text.indexOf("e-commerce") !== -1 || text.indexOf("ecommerce") !== -1 || text.indexOf("магазин") !== -1 || text.indexOf("shop") !== -1) domain = "ecommerce";
  else if (text.indexOf("crm") !== -1 || text.indexOf("sales") !== -1 || text.indexOf("ліди") !== -1 || text.indexOf("воронка") !== -1) domain = "crm";
  else if (text.indexOf("finance") !== -1 || text.indexOf("billing") !== -1 || text.indexOf("mrr") !== -1 || text.indexOf("subscription") !== -1 || text.indexOf("фінанс") !== -1) domain = "finance";
  else if (text.indexOf("product") !== -1 || text.indexOf("feature") !== -1 || text.indexOf("usage") !== -1 || text.indexOf("engagement") !== -1) domain = "product";

  var wantsChart = /chart|graph|графік|line chart|bar chart|timeseries|таймсері/.test(text);
  var wantsTable = /table|таблиц|campaign|кампані|orders|transactions|заявок|список/.test(text);
  var wantsInsights = /insight|рекомендац|notes|summary|висновк/.test(text);
  var wantsNotes = /notes|comment|опис|описання|context|контекст/.test(text);

  var wantsKPIs = /kpi|metric|метрик|цифр|revenue|roas|cac|mrr|arr|profit|margin|conversion/.test(text);

  var columns = 3;
  if (device === "mobile") {
    columns = 1;
  } else {
    if (/4\s*column|4-?колон/.test(text)) columns = 4;
    else if (/2\s*column|2-?колон/.test(text)) columns = 2;
    else if (/3\s*column|3-?колон/.test(text)) columns = 3;
  }
  if (columns < 1) columns = 1;
  if (columns > 4) columns = 4;

  var density = "normal";
  if (/compact|dense|tight|щільн|компакт/.test(text)) density = "compact";
  if (/spacious|wide|airy|простор/.test(text)) density = "relaxed";

  var spec = {
    device: device,
    domain: domain,
    columns: columns,
    density: density,
    wantsChart: wantsChart,
    wantsTable: wantsTable,
    wantsInsights: wantsInsights,
    wantsNotes: wantsNotes,
    wantsKPIs: wantsKPIs
  };

  return spec;
}

function getDomainPresets(domain) {
  if (domain === "marketing") {
    return {
      name: "Marketing dashboard",
      navbarTitle: "Marketing overview",
      navbarSubtitle: "Performance summary",
      filters: ["All channels", "Search", "Social", "Display", "Video"],
      kpis: [
        { label: "Revenue", value: "$320.4K", hint: "+8.2% vs last period" },
        { label: "ROAS", value: "5.2×", hint: "Top: Meta + Search" },
        { label: "CAC", value: "$18.30", hint: "-4.1% vs last period" },
        { label: "Active campaigns", value: "42", hint: "6 need attention" }
      ],
      tableTitle: "Active campaigns",
      tableSubtitle: "Per-channel breakdown",
      tableColumns: ["Campaign", "Channel", "Budget", "Status", "ROAS", "CTR"],
      insightsTitle: "Optimization insights"
    };
  }
  if (domain === "ecommerce") {
    return {
      name: "E-commerce dashboard",
      navbarTitle: "Store performance",
      navbarSubtitle: "Last 30 days",
      filters: ["All traffic", "Organic", "Paid", "Email", "Referral"],
      kpis: [
        { label: "Gross sales", value: "$184.9K", hint: "+11.4% vs last month" },
        { label: "Orders", value: "3,214", hint: "Avg order value $57.54" },
        { label: "Conversion rate", value: "2.8%", hint: "Checkout drop 41%" },
        { label: "Returning customers", value: "38%", hint: "+3.1 pts vs prev." }
      ],
      tableTitle: "Top products",
      tableSubtitle: "By revenue",
      tableColumns: ["Product", "Category", "Orders", "Revenue", "Margin", "Refunds"],
      insightsTitle: "Growth opportunities"
    };
  }
  if (domain === "finance") {
    return {
      name: "Finance / SaaS revenue",
      navbarTitle: "Revenue overview",
      navbarSubtitle: "Subscriptions & churn",
      filters: ["All plans", "Starter", "Growth", "Enterprise"],
      kpis: [
        { label: "MRR", value: "$92.3K", hint: "+6.4% net new" },
        { label: "ARR", value: "$1.11M", hint: "+13.2% YoY" },
        { label: "Net revenue retention", value: "118%", hint: "Expansion driven" },
        { label: "Logo churn", value: "3.1%", hint: "Within target" }
      ],
      tableTitle: "Key accounts",
      tableSubtitle: "Top 10 by MRR",
      tableColumns: ["Account", "Segment", "MRR", "Health", "Owner", "Risk"],
      insightsTitle: "Revenue insights"
    };
  }
  if (domain === "product") {
    return {
      name: "Product analytics",
      navbarTitle: "Product overview",
      navbarSubtitle: "Usage & engagement",
      filters: ["All users", "New", "Active", "Power users"],
      kpis: [
        { label: "DAU", value: "18,430", hint: "+9.8% vs last week" },
        { label: "WAU", value: "64,120", hint: "Sticky 28%" },
        { label: "Feature adoption", value: "63%", hint: "Top 3 features" },
        { label: "Retention D30", value: "41%", hint: "Cohort: Q4" }
      ],
      tableTitle: "Features",
      tableSubtitle: "Usage & adoption",
      tableColumns: ["Feature", "Area", "Users", "Adoption", "Satisfaction", "Trend"],
      insightsTitle: "Product insights"
    };
  }
  if (domain === "crm") {
    return {
      name: "CRM / Pipeline",
      navbarTitle: "Pipeline overview",
      navbarSubtitle: "Funnel performance",
      filters: ["All deals", "Open", "Won", "Lost"],
      kpis: [
        { label: "Open pipeline", value: "$842K", hint: "Spread across 63 deals" },
        { label: "Win rate", value: "27%", hint: "+2.1 pts vs Q-1" },
        { label: "Avg deal size", value: "$13.4K", hint: "Mid-market heavy" },
        { label: "Sales cycle", value: "34 days", hint: "-4 days" }
      ],
      tableTitle: "Active deals",
      tableSubtitle: "Top of funnel",
      tableColumns: ["Deal", "Stage", "Owner", "Value", "Close date", "Prob."],
      insightsTitle: "Pipeline insights"
    };
  }

  return {
    name: "Analytics dashboard",
    navbarTitle: "Analytics overview",
    navbarSubtitle: "Summary",
    filters: ["All data", "Segment A", "Segment B"],
    kpis: [
      { label: "Primary metric", value: "123K", hint: "+3.4% vs last period" },
      { label: "Secondary", value: "5.4x", hint: "Healthy performance" },
      { label: "Tertiary", value: "2.1%", hint: "Watch this metric" },
      { label: "Items", value: "64", hint: "Tracked objects" }
    ],
    tableTitle: "Main table",
    tableSubtitle: "Key records",
    tableColumns: ["Name", "Type", "Value", "Status", "Owner", "Updated"],
    insightsTitle: "Insights"
  };
}

// ======================
// 7. Побудова layout'у
// ======================

function createRootLayoutFrame(theme, deviceId, layoutName, prompt) {
  var preset = getDevicePreset(deviceId);
  var frame = figma.createFrame();
  frame.name = layoutName;
  frame.layoutMode = "VERTICAL";
  frame.primaryAxisSizingMode = "AUTO";
  frame.counterAxisSizingMode = "FIXED";
  frame.primaryAxisAlignItems = "MIN";
  frame.counterAxisAlignItems = "MIN";
  frame.itemSpacing = theme.gapLg;
  frame.paddingTop = theme.paddingLg;
  frame.paddingRight = theme.paddingLg;
  frame.paddingBottom = theme.paddingLg;
  frame.paddingLeft = theme.paddingLg;
  safeSetFills(frame, [solidPaintFromColor(theme.background)]);
  safeSetStrokes(frame, []);

  safeResize(frame, preset.width, 1000);

  var preview = "";
  if (prompt && typeof prompt === "string") {
    preview = prompt.length > 256 ? prompt.slice(0, 256) + "…" : prompt;
  }

  setPluginMetadata(frame, {
    "qwen-layout-version": LAYOUT_VERSION,
    "qwen-layout-device": deviceId,
    "qwen-layout-theme": theme.id,
    "qwen-layout-name": layoutName,
    "qwen-layout-source": "prompt-local",
    "qwen-layout-prompt-preview": preview
  });

  return frame;
}

function buildLayoutFromPrompt(prompt, payload) {
  var deviceId = payload.device || DEFAULT_DEVICE;
  var themeId = payload.themeId || DEFAULT_THEME_ID;
  var theme = getTheme(themeId);

  var analysis = analyzePrompt(prompt, deviceId);
  var presets = getDomainPresets(analysis.domain);

  var root = createRootLayoutFrame(theme, deviceId, presets.name + " (" + deviceId + ")", prompt);

  // Navbar
  var navbar = createNavbar(theme, presets.navbarTitle, presets.navbarSubtitle);
  root.appendChild(navbar);

  // Filters
  var shouldShowFilters = deviceId === "desktop" || /filter|фільтр/.test((prompt || "").toLowerCase());
  if (shouldShowFilters) {
    root.appendChild(createFilterRow(theme, presets.filters));
  }

  // KPI блок
  if (analysis.wantsKPIs || deviceId === "desktop") {
    root.appendChild(createKpiRow(theme, presets.kpis));
  }

  // GRID секція
  var grid = figma.createFrame();
  grid.name = "Content grid";
  grid.layoutMode = "HORIZONTAL";
  grid.primaryAxisSizingMode = "AUTO";
  grid.counterAxisSizingMode = "AUTO";
  grid.primaryAxisAlignItems = "MIN";
  grid.counterAxisAlignItems = "MIN"; // було STRETCH → MIN
  grid.itemSpacing = theme.gapMd;
  grid.paddingTop = 0;
  grid.paddingRight = 0;
  grid.paddingBottom = 0;
  grid.paddingLeft = 0;
  safeSetFills(grid, []);
  safeSetStrokes(grid, []);

  var columns = analysis.columns;
  if (deviceId === "mobile") columns = 1;

  var columnFrames = [];
  for (var c = 0; c < columns; c++) {
    var col = figma.createFrame();
    col.name = "Column " + (c + 1);
    col.layoutMode = "VERTICAL";
    col.primaryAxisSizingMode = "AUTO";
    col.counterAxisSizingMode = "AUTO";
    col.primaryAxisAlignItems = "MIN";
    col.counterAxisAlignItems = "MIN";
    col.itemSpacing = analysis.density === "compact" ? theme.gapSm : theme.gapMd;
    col.paddingTop = 0;
    col.paddingRight = 0;
    col.paddingBottom = 0;
    col.paddingLeft = 0;
    safeSetFills(col, []);
    safeSetStrokes(col, []);
    columnFrames.push(col);
    grid.appendChild(col);
  }

  // Вибір блоків для grid
  var blocks = [];

  if (analysis.wantsChart || analysis.domain !== "generic") {
    blocks.push({
      kind: "chart",
      column: 0,
      title: analysis.domain === "finance" ? "MRR by month" :
             analysis.domain === "ecommerce" ? "Revenue by day" :
             analysis.domain === "crm" ? "Pipeline by stage" :
             analysis.domain === "product" ? "Active users by day" :
             "Revenue by day",
      subtitle: "Last 30 days"
    });
  }

  if (analysis.wantsTable || analysis.domain !== "generic") {
    blocks.push({
      kind: "table",
      column: columns > 1 ? 1 : 0,
      title: presets.tableTitle,
      subtitle: presets.tableSubtitle
    });
  }

  if (analysis.wantsInsights || analysis.domain !== "generic") {
    blocks.push({
      kind: "insights",
      column: columns > 2 ? 2 : (columns > 1 ? columns - 1 : 0),
      title: presets.insightsTitle,
      subtitle: "Generated from prompt"
    });
  }

  if (analysis.wantsNotes) {
    blocks.push({
      kind: "notes",
      column: columns - 1,
      title: "Notes",
      subtitle: "",
      body: "Summary of context from prompt."
    });
  }

  if (blocks.length === 0) {
    blocks.push(
      { kind: "chart", column: 0, title: "Performance over time", subtitle: "Last 30 days" },
      { kind: "table", column: columns > 1 ? 1 : 0, title: presets.tableTitle, subtitle: presets.tableSubtitle },
      { kind: "insights", column: columns > 2 ? 2 : 0, title: presets.insightsTitle, subtitle: "Auto-generated" }
    );
  }

  for (var i = 0; i < blocks.length; i++) {
    var b = blocks[i];
    var colIndex = b.column;
    if (colIndex < 0) colIndex = 0;
    if (colIndex >= columnFrames.length) colIndex = columnFrames.length - 1;
    var targetCol = columnFrames[colIndex];

    var card = null;
    if (b.kind === "chart") {
      card = createChartCard(theme, b.title, b.subtitle);
    } else if (b.kind === "table") {
      var cols = presets.tableColumns;
      var rows = [
        ["Item A", "Channel A", "$12.3K", "Active", "4.3x", "2.8%"],
        ["Item B", "Channel B", "$8.4K", "Scaling", "5.1x", "3.2%"],
        ["Item C", "Channel C", "$4.7K", "Learning", "3.6x", "1.9%"]
      ];
      card = createTableCard(theme, b.title, b.subtitle, cols, rows);
    } else if (b.kind === "insights") {
      var baseInsights;
      if (analysis.domain === "marketing") {
        baseInsights = [
          "Increase budget on best performing channels.",
          "Pause underperforming ad sets with ROAS < 2.0×.",
          "Test 2–3 new creatives for top campaigns."
        ];
      } else if (analysis.domain === "ecommerce") {
        baseInsights = [
          "Optimize checkout steps with highest drop-off.",
          "Highlight top margin products on homepage.",
          "Launch limited-time bundles for returning users."
        ];
      } else if (analysis.domain === "finance") {
        baseInsights = [
          "Focus on expansion in high-NRR segments.",
          "Review discounts for low-margin accounts.",
          "Monitor churn drivers in at-risk cohorts."
        ];
      } else if (analysis.domain === "product") {
        baseInsights = [
          "Promote features with high retention impact.",
          "Simplify onboarding for new users.",
          "Analyze sessions where users drop after 1st action."
        ];
      } else if (analysis.domain === "crm") {
        baseInsights = [
          "Prioritize deals in late stages with high value.",
          "Review lost deals with high probability.",
          "Shorten cycle for stalled opportunities."
        ];
      } else {
        baseInsights = [
          "Review top trends across key metrics.",
          "Identify underperforming segments.",
          "Align actions with business goals."
        ];
      }
      card = createInsightsCard(theme, b.title, b.subtitle, baseInsights);
    } else {
      card = createNotesCard(theme, b.title || "Notes", b.subtitle || "", b.body || prompt);
    }

    targetCol.appendChild(card);
  }

  root.appendChild(grid);
  return root;
}

// ======================
// 8. Повідомлення від UI
// ======================

function sendToUI(msg) {
  try {
    figma.ui.postMessage(msg);
  } catch (e) {}
}

figma.on("run", function () {
  figma.showUI(__html__, { width: 420, height: 540 });
});

figma.ui.onmessage = function (msg) {
  if (!msg || typeof msg !== "object") return;

  if (msg.type === "close-plugin") {
    figma.closePlugin();
    return;
  }

  if (msg.type === "apply-theme") {
    applyThemeToSelection(msg.payload);
    return;
  }

  if (msg.type === "generate-layout") {
    handleGenerateLayout(msg.payload);
    return;
  }
};

// ======================
// 9. Генерація layout'у
// ======================

async function handleGenerateLayout(payload) {
  if (generationState.isRunning) {
    sendToUI({ type: "layout-busy" });
    return;
  }

  generationState.isRunning = true;

  try {
    var prompt = (payload && payload.prompt) ? String(payload.prompt) : "";
    var deviceId = (payload && payload.device) ? String(payload.device) : DEFAULT_DEVICE;
    var themeId = (payload && payload.themeId) ? String(payload.themeId) : DEFAULT_THEME_ID;
    var theme = getTheme(themeId);

    await loadFontsForTheme(theme);

    var frame = buildLayoutFromPrompt(prompt, {
      device: deviceId,
      themeId: themeId
    });

    figma.currentPage.appendChild(frame);
    figma.currentPage.selection = [frame];
    figma.viewport.scrollAndZoomIntoView([frame]);

    var nodeCount = countNodesUnder(frame, MAX_LAYOUT_NODES + 1);
    if (nodeCount > MAX_LAYOUT_NODES) {
      safeNotify(PLUGIN_NAME + ": layout дуже великий (" + nodeCount + " елементів)", { timeout: 4000 });
    } else {
      safeNotify(PLUGIN_NAME + ": layout згенеровано", { timeout: 2000 });
    }

    sendToUI({
      type: "layout-generated",
      payload: {
        backendStatus: "ok"
      }
    });
  } catch (e) {
    safeNotify(PLUGIN_NAME + ": помилка при генерації layout'у", { timeout: 4000 });
    sendToUI({
      type: "layout-error",
      payload: { message: String(e && e.message ? e.message : e) }
    });
  } finally {
    generationState.isRunning = false;
  }
}

// ======================
// 10. Застосування теми до selection
// ======================

function applyThemeToSelection(payload) {
  var themeId = (payload && payload.themeId) ? String(payload.themeId) : DEFAULT_THEME_ID;
  var theme = getTheme(themeId);

  var selection = figma.currentPage.selection;
  if (!selection || selection.length === 0) {
    safeNotify("Вибери хоча б один фрейм для застосування теми.", { timeout: 2500 });
    return;
  }

  for (var i = 0; i < selection.length; i++) {
    var node = selection[i];
    if (node.type === "FRAME" || node.type === "COMPONENT" || node.type === "INSTANCE") {
      recolorFrame(node, theme);
    }
  }

  safeNotify("Тема застосована до вибраних фреймів.", { timeout: 2500 });
  sendToUI({ type: "theme-applied" });
}

function recolorFrame(node, theme) {
  if (!node || !("children" in node)) return;
  if (node.name && node.name.toLowerCase().indexOf("background") !== -1) {
    safeSetFills(node, [solidPaintFromColor(theme.background)]);
  } else {
    safeSetFills(node, [solidPaintFromColor(theme.surface)]);
  }

  var children = node.children;
  for (var i = 0; i < children.length; i++) {
    var child = children[i];
    if ("children" in child) {
      recolorFrame(child, theme);
    } else if (child.type === "TEXT") {
      safeSetFills(child, [solidPaintFromColor(theme.textPrimary)]);
    } else if (child.type === "RECTANGLE" || child.type === "ELLIPSE") {
      safeSetFills(child, [solidPaintFromColor(theme.surfaceAlt)]);
    }
  }
}