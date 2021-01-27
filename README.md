# Mongose Paginator

# Installation

`npm i @andrew_l/mongoose-cursor-paginator`

```js
import mongoose from 'mongoose';
import mongoosePaginator from 'mongoose-cursor-paginator';

mongoosePaginator(mongoose);
```

# Usage examples

## Simple search with catching filter & sort options of original mongoose query. 
```js
// Fetch the first page
const firstPage = await Users.find({ role: 'admin' })
	.limit(10)
	.sort({ createdAt: -1 })
	.lean()
	.paginator();

console.log(firstPage);
/* {
  "metadata": {
	"hasNext": true,
	"next": "ldkkZjBhZTViZTQtNzRkNC00YzY2LWI2MWItYjMzYjE0NzQwODI4pFVzZXKBo19pZP-Bo19pZNkkZjBhZTViZTQtNzRkNC00YzY2LWI2MWItYjMzYjE0NzQwODI4gA"
  },
  "items": [
	{ doc_1 },
	{ doc_n },
	...
	{ doc_10 },
  ]
} */

const secondPage = await Users.find({ role: 'admin' })
	.limit(10)
	// sort can be overwrited by next token
	.sort({ createdAt: -1 })
	.lean()
	.paginator({
		next: firstPage.metadata.next
	});
	
console.log(secondPage);
/* {
  "metadata": {
	"hasNext": false,
	"next": null
  },
  "items": [
	{ doc_1 },
	{ doc_2 },
	{ doc_3 }
  ]
} */
```

## Advanced usage with passing paginator options by hand

```js
import { paginCursor } from 'mongoose-cursor-paginator';

// Make query with some criteria
const firstPage = await searchUsers({
	role: 'admin'
});

// Now we can pass only next cursor and keep the role conditions from previous query
const secondPage = await searchUsers({
	next: firstPage.metadata.next
});

function searchUsers(queryParams) {
	const paginOptions = {
		queryFilter: {},
		queryOptions: {
			sort: { status: 1, createdAt: -1, _id: 1 },
			limit: 10
		},
		// Indicates that we don't wanna to use 'status' as a range condition for next queries
		paginationFields: ['createdAt', '_id'],
		
		// Set current query params as payload for next cursor token
		preQuery: function() {
			this.next.payload = queryParams;
		}
	}
	
	if (queryParams.next) {
		// Handly decode cursor token
		paginOptions.next = paginCursor.decode(queryParams.next);

		// Set payload data as query params from previous request
		queryParams = paginOptions.next.payload;
	}

	// Parse query object and pass into db conditions
	if (typeof queryParams.role === 'string') {
		paginOptions.queryFilter.role = queryParams.role;
	}

	 return Users.find()
		.lean()
		.paginator(paginOptions);
}
```

## Stream usage

```js
// Fetch the first page
const dbQuery = await Users.find({ role: 'admin' })
	.limit(10)
	.sort({ createdAt: -1 })
	.lean();

const dbStream = await dbQuery.paginator.stream();

dbStream.on('data', console.log);
dbStream.on('end', () => {
    const metadata = dbQuery.paginator().getMetadata();
    console.log({ metadata });
    /* {
      "metadata": {
    	"hasNext": true,
    	"next": "ldkkZjBhZTViZTQtNzRkNC00YzY2LWI2MWItYjMzYjE0NzQwODI4pFVzZXKBo19pZP-Bo19pZNkkZjBhZTViZTQtNzRkNC00YzY2LWI2MWItYjMzYjE0NzQwODI4gA"
      }
    */
});
```

### Tips
- The last sorting key **must be uniq** & sortable (Number, ObjectId has perfect)
