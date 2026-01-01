
import fs from 'fs';
import PizZip from 'pizzip';

const path = 'src/templates/template_backup/01立项/01项目建议书/xx项目建议书.docx';

try {
    const content = fs.readFileSync(path);
    const zip = new PizZip(content);
    const docXml = zip.file('word/document.xml')?.asText();

    if (docXml) {
        console.log("--- Searching for TOC markers ---");
        // Look for common TOC indicators
        const tocIndex = docXml.indexOf('TOC');
        if (tocIndex !== -1) {
            console.log("Found 'TOC' keyword at index:", tocIndex);
            console.log("Context:");
            console.log(docXml.substring(tocIndex - 200, tocIndex + 200));
        } else {
            console.log("'TOC' keyword not found.");
        }

        // Look for field chars (w:fldChar)
        const fldCharIndex = docXml.indexOf('<w:fldChar');
        if (fldCharIndex !== -1) {
            console.log("\nFound <w:fldChar> at index:", fldCharIndex);
            console.log("Context:");
            console.log(docXml.substring(fldCharIndex - 100, fldCharIndex + 300));
        }

    } else {
        console.log("Could not read word/document.xml");
    }
} catch (e) {
    console.error(e);
}
