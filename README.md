# dynamodb-mongostyle
Simple shell interface for DynamoDB, in the style of MongoDB's shell

by Ian White, Stardog Ventures

## What is this?

DynamoDB is great for a lot of situations, but one of the things I personally miss when using it instead of MongoDB (or SQL databases for that matter) is the ease-of-use of the shell.

DynamoDB's query language is pretty verbose and it's not incredibly easy to issue simple queries, or write quick scripts to update a bunch of records.

So -- here is a first attempt at a Mongo-style console interface. I've used this in production to explore data and do simple maintenance. This is a very very early draft, so please use caution if you use this against production datasets.

## Installation

Requires Node.

```
git clone https://github.com/stardogventures/dynamodb-mongostyle.git
cd dynamodb-mongostyle
npm install (or yarn install)
```

## Running

```
node shell.js
```

By default, this connects you with your default profile.

## Command line options

```
--region <region> - AWS region to use (defaults to us-east-1)
--key <key> - AWS key to use for credentials
--secret <secret> - AWS secret to use for credentials
--tableprefix <prefix> - use if all your tables have an identical prefix (such as "prod-") and you only want to use those tables
```

Note that if you want to use AWS credential profiles, you have to set it as an `AWS_PROFILE` environment var, so if needed run like so:

```
AWS_PROFILE=my-profile-name node shell.js
```

## Commands

The shell works exactly as the standard Node REPL, so you can write little scripts if needed.

#### `showTables()`
Prints a list of all of your DynamoDB tables

#### `db.<table>.find(query, options, callback)`
Performs a query using MongoDB-style syntax. The query "planner" will examine the structure of your table and attempt to perform a DynamoDB query if it finds a matching hash key or global secondary index, but if it can't find a matching index it will perform a scan, so be wary.

Query operators supported:
  - `$gt` - greater-than
  - `$gte` - greater-than-or-equal
  - `$lt` - less-than
  - `$lte` - less-than-or-equal
  - `$ne` - not-equal
  
Example:

```
db.user.find( { email: 'info@stardog.io', failedLogins: { $gte: 1 } } );
```

Options:
  - `limit` - max number of results to return; defaults to 10, set to a higher number, or null if you want to return all results
  - `explain` - if set to true, will print an explanation of the query before printing results
  
Callback:

If no callback is passed, the query results will be printed. However, if you pass a callback function, it will be called once for each found result.

Example:

```
db.user.find( { status: 'ACTIVE' }, {}, function(u) { u.status = 'INACTIVE'; console.log(u.name); db.user.save(u); } );
```

#### `db.<table>.explain(query)`

Print an explanation of the query and what it has been translated to in DynamoDB query language.

#### `db.<table>.save(item)`

Save an item into a table. (Performs a DynamoDB `put` operation under the hood.)

More to come...
