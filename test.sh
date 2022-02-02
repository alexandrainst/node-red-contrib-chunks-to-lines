#!/bin/sh

test=$(
	cat <<'EOF' | node ./index.js chunks-to-lines --linesFormat='"csv"' --nbLines='2'
{"payload": "A;B;C\n1;2;3\n4;5;6\n7;8;9\n10;11;12\n"}
{"tick": true}
{"tick": true}
EOF
)

ref=$(
	cat <<'EOF'
{"payload":"A;B;C\n1;2;3\n","_parts":{"id":"","type":"string","ch":"","index":0,"lines":2}}
{"payload":"A;B;C\n4;5;6\n7;8;9\n","_parts":{"id":"","type":"string","ch":"","index":1,"lines":4}}
{"payload":"A;B;C\n10;11;12\n","_parts":{"id":"","type":"string","ch":"","index":2,"lines":5}}
EOF
)

if [ "$test" = "$ref" ]; then
	echo 'OK'
	exit 0
else
	echo 'ERROR'
	exit 1
fi
