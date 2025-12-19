const fs = require("fs");
const path = require("path");

function getFiles(dir) {
  const dirents = fs.readdirSync(dir, { withFileTypes: true });
  const files = dirents.map((dirent) => {
    const res = path.resolve(dir, dirent.name);
    return dirent.isDirectory() ? getFiles(res) : res;
  });
  return Array.prototype.concat(...files);
}

const agentsDir = path.join(__dirname, "..", "agent");
const files = getFiles(agentsDir).filter((f) => f.endsWith(".md"));

files.forEach((file) => {
  let content = fs.readFileSync(file, "utf8");
  const modelMatch = content.match(/^model:\s*(.+)$/m);
  if (modelMatch) {
    const model = modelMatch[1].toLowerCase();
    let tier = "";
    if (model.includes("opus")) tier = "1";
    else if (model.includes("sonnet")) tier = "1";
    else if (model.includes("pro")) tier = "2";
    else if (model.includes("flash")) tier = "3";
    else if (model.includes("pickle")) tier = "4";

    if (tier && !content.includes("\ntier:")) {
      content = content.replace(/^(name:\s*.+)$/m, `$1\ntier: ${tier}`);
      fs.writeFileSync(file, content);
      console.log(
        `Updated ${path.relative(process.cwd(), file)} with Tier ${tier}`,
      );
    }
  }
});
