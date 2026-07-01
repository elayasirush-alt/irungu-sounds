IRUNGU SOUNDS PRO COMMON 7000 - PORTABLE VERSION

NO RENAMING NEEDED.
NO MOVING NEEDED.

LOCAL USE

1. Right-click the ZIP.
2. Click Extract All.
3. Open the extracted folder.
4. Double-click START_IRUNGU_SOUNDS.bat.

The launcher works from any folder.

FIRST TIME ONLY

Open PowerShell inside the extracted folder and run:

npm.cmd install
cd server
npm.cmd install

Then double-click START_IRUNGU_SOUNDS.bat.

ONLINE/GITHUB UPLOAD

Upload/copy everything from the extracted folder EXCEPT:

node_modules

Required files/folders:

Dockerfile
package.json
index.html
public
server
src
render.yaml
railway.toml

Very important:
The public folder must be included because public/sfx contains the sound effects.
