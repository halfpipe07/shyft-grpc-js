import fs from 'fs';

export function printToFile(obj, filename = 'sample') {
  fs.writeFile(`${filename}.js`, JSON.stringify( obj ), function(err) {
     if(err) {
         return console.log(err);
     }

     console.log("The file was saved!");
  });
}