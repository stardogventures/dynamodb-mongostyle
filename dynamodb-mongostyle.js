showTables = function() {
	var request = dynamodb.listTables(function(err, data) {
		data.TableNames.forEach(function(table) {
			console.log(table);
		})
	});
}

jsonToDynamo = function(data, nested) {
	if (typeof(data) == 'string') {
		return { 'S': data };
	} else if (typeof(data) == 'number') {
		return { 'N': '' + data };
	} else if (typeof(data) == 'boolean') {
		return { 'BOOL': data };
	} else if (Array.isArray(data)) {
		return { 'L': data.map(item => jsonToDynamo(item, true)) };
	} else {
		var map = {};
		for (var k in data) {
			map[k] = jsonToDynamo(data[k], true);
		}
		return nested ? { 'M': map } : map;
	}
}

dynamoToJson = function(data) {
	if (data.S !== undefined) {
		return data.S;
	} else if (data.N !== undefined) {
		return Number(data.N);
	} else if (data.BOOL !== undefined) {
		return data.BOOL;
	} else if (data.L !== undefined) {
		var result = [];
		for (var i=0; i < data.L.length; i++) {
			result.push(dynamoToJson(data.L[i]));
		}
		return result;
	} else if (data.M !== undefined) {
		var result = {};
		for (var k in data.M) {
			result[k] = dynamoToJson(data.M[k]);
		}
		return result;
	} else {
		var result = {};
		for (var k in data) {
			result[k] = dynamoToJson(data[k]);
		}
		return result;
	}
}

getSchemaHash = function(schema) {
	for (var i=0; i<schema.length; i++) {
		if (schema[i].KeyType == 'HASH') {
			return schema[i].AttributeName;
		}
	}
	return null;
}

getSchemaRange = function(schema) {
	for (var i=0; i<schema.length; i++) {
		if (schema[i].KeyType == 'RANGE') {
			return schema[i].AttributeName;
		}
	}
	return null;
}

function getBestIndex(query, indexes) {
	if (!indexes) {
		return null;
	}
	for (var i=0; i < indexes.length; i++) {
		var hash = getSchemaHash(indexes[i].KeySchema);
		if (query[hash] !== undefined && typeof(query[hash]) !== 'object') {
			return indexes[i];
		}
	}
	return null;
}

queryValueToExpression = function(key, value) {
	let expression = null;

	if (value && typeof(value) === 'object') {
		if (value['$ne'] === null) {
			expression = 'attribute_exists(#'+key+')';
			value = null;
		} else if (value['$ne'] !== undefined) {
			expression = '#'+key+' <> :'+key;
			value = value['$ne'];
		} else if (value['$gt'] !== undefined) {
			expression = '#'+key+' > :'+key;
			value = value['$gt'];
		} else if (value['$gte'] !== undefined) {
			expression = '#'+key+' >= :'+key;
			value = value['$gte'];
		} else if (value['$lt'] !== undefined) {
			expression = '#'+key+' < :'+key;
			value = value['$lt'];
		} else if (value['$lte'] !== undefined) {
			expression = '#'+key+' <= :'+key;
			value = value['$lte'];
		} else {
			throw Exception('invalid query expression: ' + JSON.stringify(value));
		}
	} else if (value === null) {
		expression = 'attribute_not_exists(#' + key + ')';
		value = null;
	} else {
		expression = '#'+key + ' = :'+key;
	}

	return {
		expression: expression,
		value: value
	}
}

getBestQuery = function(query, tableName, tableDesc) {
	var attribNames = {};
	var attribValues = {};
	var keyConditionExpression = '';
	var filterExpression = '';
	var indexName = null;

	var keyHash = getSchemaHash(tableDesc.Table.KeySchema);
	if (query[keyHash] !== undefined && typeof(query[keyHash]) !== 'object') {
		attribNames['#'+keyHash] = keyHash;
		let expr = queryValueToExpression(keyHash, query[keyHash]);
		if (expr.value) {
			attribValues[':'+keyHash] = jsonToDynamo(expr.value);
		}
		keyConditionExpression = expr.expression;
	} else {
		var index = getBestIndex(query, tableDesc.Table.GlobalSecondaryIndexes);
		if (index) {
			var keyHash = getSchemaHash(index.KeySchema);
			attribNames['#'+keyHash] = keyHash;
			let expr = queryValueToExpression(keyHash, query[keyHash]);
			if (expr.value) {
				attribValues[':'+keyHash] = jsonToDynamo(expr.value);
			}
			keyConditionExpression = expr.expression;
			indexName = index.IndexName;
		}
	}

	for (var k in query) {
		if (!attribNames['#'+k]) {
			attribNames['#'+k] = k;
			let expr = queryValueToExpression(k, query[k]);
			if (expr.value !== undefined) {
				attribValues[':'+k] = jsonToDynamo(expr.value);
			}
			filterExpression += ' AND ' + expr.expression;
		}
	}
	filterExpression = filterExpression.substring(5);
	var options = {
		TableName: tableName,
		Limit: 10
	};
	var type = 'scan';
	if (Object.keys(attribNames).length > 0) {
		options.ExpressionAttributeNames = attribNames;
	}
	if (Object.keys(attribValues).length > 0) {
		options.ExpressionAttributeValues = attribValues;
	}
	if (keyConditionExpression) {
		options.KeyConditionExpression = keyConditionExpression;
		type = 'query';
	}
	if (indexName) {
		options.IndexName = indexName;
	}
	if (filterExpression) {
		options.FilterExpression = filterExpression;
	}
	return {
		type: type,
		options: options
	}
}

wrapTableFunctions = function(tableName) {
	return {
		findOne: function(id) {
			var options = { TableName: tableName, Key: jsonToDynamo(id) };
			dynamodb.getItem(options, function(err, data) {
				console.log(data);
				console.log(dynamoToJson(data.Item));
			});
		},

		find: function(query, options, callback) {
			if (!query) {
				query = {};
			}
			if (!options) {
				options = {};
			}
			dynamodb.describeTable( { TableName: tableName }, function(err, data) {
				var bestQuery = getBestQuery(query, tableName, data);
				if (options.explain) {
					console.log(bestQuery);
				}
				if (options.limit) {
					bestQuery.options.Limit = options.limit;
				}
				if (bestQuery.type == 'scan') {
					dynamodb.scan(bestQuery.options, function(err, data) {
						if (err) {
							console.error(err);
						} else {
							data.Items.forEach(function(item) {
								if (callback) {
									callback(dynamoToJson(item));
								} else {
									console.log(dynamoToJson(item));
								}
							});
						}
					})
				} else {
					dynamodb.query(bestQuery.options, function(err, data) {
						if (err) {
							console.error(err);
						} else {
							data.Items.forEach(function(item) {
								if (callback) {
									callback(dynamoToJson(item));
								} else {
									console.log(dynamoToJson(item));
								}
							})
						}
					})
				}
			});
		},

		save: function(item) {
			dynamodb.putItem( { TableName: tableName, Item: jsonToDynamo(item) }, function(err, data) {
				if (err) {
					console.error(err);
				}
			});
		},

		explain: function(query) {
			dynamodb.describeTable( { TableName: tableName }, function(err, data) {
				if (err) {
					console.error(err);
				} else {
					console.log(getBestQuery(query, tableName, data));
				}
			});
		},

		getIndexes: function() {
			dynamodb.describeTable( { TableName: tableName }, function(err, data) {
				data.Table.GlobalSecondaryIndexes.forEach(function(index) {
					console.log(index);
				});
			});
		}
	}
}