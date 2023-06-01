#!/bin/sh

test=$(
	cat <<'EOF' | node ./index.js chunks-to-lines --linesFormat='"csv"' --nbLines='2' | sed 's/"id":"[0-9.]*"/"id":""/g'
{"payload": "A;B;C\n1;2;3\n"}
{"payload": "4;5;6\n7;8;9\n10;11;12\n", "complete": true}
{"tick": true}
{"tick": true}
{"payload": "D;E;F\n21;22;23\n24;25;26\n27;28;29\n30;31;32\n", "complete": true}
{"tick": true}
{"tick": true}
{"tick": true}
EOF
)

ref=$(
	cat <<'EOF'
{"payload":"A;B;C\n1;2;3\n","_parts":{"id":"","type":"string","ch":"","index":0,"lines":2}}
{"payload":"A;B;C\n4;5;6\n7;8;9\n","_parts":{"id":"","type":"string","ch":"","index":1,"lines":4}}
{"payload":"A;B;C\n10;11;12\n","complete":true,"_parts":{"id":"","type":"string","ch":"","index":2,"count":3,"lines":5}}
{"payload":"D;E;F\n21;22;23\n","_parts":{"id":"","type":"string","ch":"","index":0,"lines":2}}
{"payload":"D;E;F\n24;25;26\n27;28;29\n","_parts":{"id":"","type":"string","ch":"","index":1,"lines":4}}
{"payload":"D;E;F\n30;31;32\n","complete":true,"_parts":{"id":"","type":"string","ch":"","index":2,"count":3,"lines":5}}
EOF
)

if [ "$test" = "$ref" ]; then
	echo 'OK'
	exit 0
else
	echo 'ERROR'
	exit 1
fi
