
import fs from 'fs';
import PizZip from 'pizzip';

const path = 'src/templates/template_backup/01立项/01项目建议书/xx项目建议书.docx';

try {
    const content = fs.readFileSync(path);
    const zip = new PizZip(content);
    const docXml = zip.file('word/document.xml')?.asText();

    if (docXml) {
        console.log("Length of XML:", docXml.length);
        if (docXml.includes('{') && docXml.includes('}')) {
            console.log("Found curly braces! Sample:", docXml.substring(docXml.indexOf('{'), docXml.indexOf('{') + 50));
        } else {
            console.log("No curly braces found.");
        }
    } else {
        console.log("Could not read word/document.xml");
    }
} catch (e) {
    console.error(e);
}
