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
})