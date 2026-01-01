
import fs from 'fs';
import PizZip from 'pizzip';

const path = 'src/templates/template_backup/01立项/01项目建议书/xx项目建议书.docx';

try {
    const content = fs.readFileSync(path);
    const zip = new PizZip(content);
    const docXml = zip.file('word/document.xml')?.asText();

    if (docXml) {
        // Find a known header or text to see its XML structure
        // Let's look for "项目概述" or similar if known, or just print the first 2000 chars formatted
        console.log("--- XML Snippet ---");
        console.log(docXml.substring(0, 2000));

        // Try to find a specific header pattern
        // Assuming there are headers like "一、" or "1."
        const match = docXml.match(/<w:t>[^<]*项目[^<]*<\/w:t>/);
        if (match) {
            console.log("\n--- Found '项目' Text Run ---");
            const start = Math.max(0, match.index! - 200);
            const end = Math.min(docXml.length, match.index! + 500);
            console.log(docXml.substring(start, end));
        }

    } else {
        console.log("Could not read word/document.xml");
    }
} catch (e) {
    console.error(e);
}
