aws = require('aws-sdk')

require('./dynamodb-mongostyle')
var argv = require('minimist')(process.argv.slice(2));

if (argv.help) {
	console.log("node shell.js [--region <region>] [--profile <profile>] [--key <key>] [--secret <secret>] [--tableprefix <tableprefix>]");
	process.exit();
}

let config = {
	region: argv.region ? argv.region : 'us-east-1'
}
if (argv.profile) {
	config.profile = argv.profile;
}
if (argv.key) {
	config.accessKeyId = argv.key;
}
if (argv.secret) {
	config.secretAccessKey = argv.secret;
}
aws.config.update(config);

dynamodb = new aws.DynamoDB();

db = {};
dynamodb.listTables(function(err, data) {
	if (err) {
		console.error(err);
	} else {
		data.TableNames.forEach(function(table) {
			db[table] = wrapTableFunctions(table);
			if (argv.tableprefix) {
				db[table.replace(argv.tableprefix, '')] = wrapTableFunctions(table);
			}
		});
	}
});

require('repl').start({ignoreUndefined: true})