// @ts-nocheck
const http = require('http');

http.get('http://localhost:3000/api/clips', (res) => {
    let data = '';

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            const clip177 = json.clips.find((c) => c.id === '177');

            if (!clip177) {
                console.log('Clip 177 not found');
            } else {
                console.log('Clip 177 Data:');
                console.log('  Character:', clip177.character);
                console.log('  CharacterImageUrls:', clip177.characterImageUrls);
                console.log('  Series:', clip177.series);
            }

            const libItem = json.libraryItems.find((i) => i.name === 'Jack_Parsons_Roswell');
            console.log('Library Item Jack_Parsons_Roswell:', libItem);

        } catch (e) {
            console.error(e.message);
        }
    });

}).on('error', (err) => {
    console.error('Error: ' + err.message);
});
