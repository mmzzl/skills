const pptxgen = require("pptxgenjs");
const fs = require("fs");
const path = require("path");

const csvPath = "D:/myskills/skills/news-analysis/scripts/all_stock_industry.csv";
const outputPath = "D:/myskills/skills/stock_industry_classification.pptx";

const content = fs.readFileSync(csvPath, "utf-8");
const lines = content.split("\n").filter(l => l.trim());
const headers = lines[0].split(",").map(h => h.trim());

const data = lines.slice(1).map(line => {
  const values = line.split(",");
  const obj = {};
  headers.forEach((h, i) => {
    obj[h] = values[i]?.trim() || "";
  });
  return obj;
});

const boardCounts = {};
data.forEach(row => {
  const board = row["板块名称"];
  if (board) {
    boardCounts[board] = (boardCounts[board] || 0) + 1;
  }
});

const sortedBoards = Object.entries(boardCounts)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 30);

let pres = new pptxgen();
pres.layout = "LAYOUT_16x9";
pres.title = "A股股票板块分类";
pres.author = "Stock Analysis";

const colorPalette = {
  primary: "1E3A5F",
  secondary: "2D5F8B",
  accent: "4ECDC4",
  light: "F7F9FC",
  dark: "1A1A2E",
  text: "333333",
  muted: "666666"
};

let slide1 = pres.addSlide();
slide1.background = { color: colorPalette.primary };

slide1.addText("A股股票板块分类", {
  x: 0.5, y: 1.8, w: 9, h: 1.2,
  fontSize: 44, fontFace: "Arial", color: "FFFFFF", bold: true
});

slide1.addText(`共 ${data.length} 只股票，${Object.keys(boardCounts).length} 个板块`, {
  x: 0.5, y: 3.2, w: 9, h: 0.6,
  fontSize: 20, fontFace: "Arial", color: colorPalette.accent
});

slide1.addShape(pres.shapes.RECTANGLE, {
  x: 0.5, y: 4.2, w: 2, h: 0.08, fill: { color: colorPalette.accent }
});

let slide2 = pres.addSlide();
slide2.background = { color: colorPalette.light };

slide2.addText("板块分布概览", {
  x: 0.5, y: 0.3, w: 9, h: 0.8,
  fontSize: 32, fontFace: "Arial", color: colorPalette.dark, bold: true
});

slide2.addShape(pres.shapes.RECTANGLE, {
  x: 0.5, y: 1.0, w: 1.2, h: 0.06, fill: { color: colorPalette.accent }
});

const topBoards = sortedBoards.slice(0, 10);
const chartData = topBoards.map(([name, count]) => ({
  name: name.substring(0, 8) + (name.length > 8 ? "..." : ""),
  labels: [name],
  values: [count]
}));

slide2.addChart(pres.charts.BAR, chartData, {
  x: 0.5, y: 1.4, w: 9, h: 3.8,
  barDir: "col",
  chartColors: [colorPalette.secondary],
  showValue: true,
  dataLabelPosition: "outEnd",
  dataLabelColor: colorPalette.text,
  valGridLine: { color: "E0E0E0", size: 0.5 },
  catGridLine: { style: "none" },
  catAxisLabelColor: colorPalette.muted,
  valAxisLabelColor: colorPalette.muted
});

let slide3 = pres.addSlide();
slide3.background = { color: colorPalette.light };

slide3.addText("Top 20 板块详情", {
  x: 0.5, y: 0.3, w: 9, h: 0.8,
  fontSize: 32, fontFace: "Arial", color: colorPalette.dark, bold: true
});

slide3.addShape(pres.shapes.RECTANGLE, {
  x: 0.5, y: 1.0, w: 1.2, h: 0.06, fill: { color: colorPalette.accent }
});

const tableData = [["排名", "板块名称", "股票数量"]];
sortedBoards.forEach(([name, count], idx) => {
  tableData.push([(idx + 1).toString(), name, count.toString()]);
});

slide3.addTable(tableData, {
  x: 0.5, y: 1.3, w: 9, h: 4,
  colW: [0.8, 6.4, 1.8],
  border: { pt: 0.5, color: "DDDDDD" },
  fontFace: "Arial",
  fontSize: 11,
  color: colorPalette.text,
  align: "center",
  valign: "middle"
});

for (let i = 0; i < sortedBoards.length + 1; i++) {
  const bgColor = i === 0 ? colorPalette.primary : (i % 2 === 0 ? "F5F7FA" : "FFFFFF");
  const textColor = i === 0 ? "FFFFFF" : colorPalette.text;
  slide3.addShape(pres.shapes.RECTANGLE, {
    x: 0.5, y: 1.3 + i * 0.19, w: 9, h: 0.19,
    fill: { color: bgColor }
  });
  if (i > 0) {
    slide3.addText(tableData[i][0], { x: 0.5, y: 1.3 + i * 0.19, w: 0.8, h: 0.19, fontSize: 11, color: textColor, align: "center", valign: "middle" });
    slide3.addText(tableData[i][1], { x: 1.3, y: 1.3 + i * 0.19, w: 6.4, h: 0.19, fontSize: 11, color: textColor, align: "left", valign: "middle" });
    slide3.addText(tableData[i][2], { x: 7.7, y: 1.3 + i * 0.19, w: 1.8, h: 0.19, fontSize: 11, color: textColor, align: "center", valign: "middle" });
  } else {
    slide3.addText("排名", { x: 0.5, y: 1.3, w: 0.8, h: 0.19, fontSize: 11, color: textColor, bold: true, align: "center", valign: "middle" });
    slide3.addText("板块名称", { x: 1.3, y: 1.3, w: 6.4, h: 0.19, fontSize: 11, color: textColor, bold: true, align: "center", valign: "middle" });
    slide3.addText("股票数量", { x: 7.7, y: 1.3, w: 1.8, h: 0.19, fontSize: 11, color: textColor, bold: true, align: "center", valign: "middle" });
  }
}

let slide4 = pres.addSlide();
slide4.background = { color: colorPalette.dark };

slide4.addText("数据说明", {
  x: 0.5, y: 0.5, w: 9, h: 0.7,
  fontSize: 28, fontFace: "Arial", color: "FFFFFF", bold: true
});

slide4.addText([
  { text: "• 数据来源：A股股票板块分类数据", options: { breakLine: true } },
  { text: "• 板块数量：" + Object.keys(boardCounts).length + " 个", options: { breakLine: true } },
  { text: "• 股票总数：" + data.length + " 只", options: { breakLine: true } },
  { text: "• 数据类型：概念板块（非行业分类）", options: { breakLine: true } }
], {
  x: 0.5, y: 1.5, w: 8, h: 3,
  fontSize: 16, fontFace: "Arial", color: "CCCCCC", lineSpaceMult: 1.8
});

slide4.addText("Generated with Stock Analysis Tools", {
  x: 0.5, y: 4.8, w: 9, h: 0.4,
  fontSize: 12, fontFace: "Arial", color: "666666"
});

pres.writeFile({ fileName: outputPath })
  .then(() => console.log("Created: " + outputPath))
  .catch(err => console.error(err));