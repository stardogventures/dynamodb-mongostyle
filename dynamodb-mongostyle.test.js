require('./dynamodb-mongostyle');

test('getSchemaHash', () => {
	expect(getSchemaHash( [ { AttributeName: 'id', KeyType: 'HASH' } ] )).toEqual('id');
});

test('getSchemaRange', () => {
	expect(getSchemaRange( [ { AttributeName: 'date', KeyType: 'RANGE' } ] )).toEqual('date');
});

test('jsonToDynamo', () => {
	expect(jsonToDynamo(2)).toEqual( { 'N': '2' });
	expect(jsonToDynamo('string')).toEqual( { 'S': 'string' });
	expect(jsonToDynamo([1,2,3]))
		.toEqual( { 'L': [ { 'N': '1' }, { 'N': '2' }, { 'N': '3'}] });

	expect(jsonToDynamo( { test: 1 }))
		.toEqual( { 'test': { 'N': '1' }})		

	expect(jsonToDynamo({ list: [1,2,3] }))
		.toEqual( { 'list': { 'L': [ { 'N': '1' }, { 'N': '2' }, { 'N': '3'}] } });
});

test('queryValueToExpression', () => {
	expect(queryValueToExpression('foo', 'bar'))
		.toEqual( { expression: '#foo = :foo', value: 'bar' });
	expect(queryValueToExpression('foo', null))
		.toEqual( { expression: 'attribute_not_exists(#foo)', value: null });
	expect(queryValueToExpression('foo', { $gt: 0 } ))
		.toEqual( { expression: '#foo > :foo', value: 0 });
	expect(queryValueToExpression('foo', { $lt: 3 } ))
		.toEqual( { expression: '#foo < :foo', value: 3 });
	expect(queryValueToExpression('foo', { $gte: 5 } ))
		.toEqual( { expression: '#foo >= :foo', value: 5 });
	expect(queryValueToExpression('foo', { $lte: 5 } ))
		.toEqual( { expression: '#foo <= :foo', value: 5 });
	expect(queryValueToExpression('foo', { $ne: 'bar' } ))
		.toEqual( { expression: '#foo <> :foo', value: 'bar' });
});

test('getBestQuery', () => {
	let tableDesc = {
		Table: {
			KeySchema: [ { KeyType: 'HASH', AttributeName: 'id' }]
		}
	};
	expect(getBestQuery({ id: 'myid' }, 'tableName', tableDesc))
		.toEqual( {
			type: 'query',
			options: {
				TableName: 'tableName',
				Limit: 10,
				ExpressionAttributeNames: { '#id': 'id' },
				ExpressionAttributeValues: { ':id': { 'S': 'myid' } },
				KeyConditionExpression: '#id = :id'
			}
		});
	expect(getBestQuery({ foo: { $gt: 0 } }, 'tableName', tableDesc))
		.toEqual( {
			type: 'scan',
			options: {
				TableName: 'tableName',
				Limit: 10,
				ExpressionAttributeNames: { '#foo': 'foo' },
				ExpressionAttributeValues: { ':foo': { 'N': '0' } },
				FilterExpression: '#foo > :foo'
			}
		});
})