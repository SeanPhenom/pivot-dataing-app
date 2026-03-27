---
title: Create AI Chart
url: https://developer.luzmo.com/api/createAI-Chart
type: api
resource: aichart
action: create
method: POST
---

# Create AI Chart

Retrieve AI-generated chart suggestions based on the structure of a specified dataset and optionally a user-specified prompt.

 To use AI-generated charts, an Organization Owner must enable the experimental feature in the Organization profile. When using Luzmo AI, we may send dataset metadata like column names and descriptions to OpenAI. Row-level data from your sets is never shared.

Find potential use cases on our [blog](https://www.luzmo.com/blog/ai-chart-generator).

The chart generator can currently create charts of the following types: `area-chart`, `bar-chart`, `bubble-chart`, `circle-pack-chart`, `column-chart`, `donut-chart`, `line-chart`, `evolution-number`, `pivot-table`, `regular-table`, `scatter-plot`, `sunburst-chart` and `treemap-chart` and filters of the following types: `date-filter`, `dropdown-filter`, `slicer-filter` and `slider-filter`. The generator can suggest chart types automatically based on the context or you can guide it to a particular type. Chart option support is continuously expanding.

## Endpoint

- **Method**: `POST` (all Luzmo API calls use POST with an action parameter)
- **Path**: `/aichart`
- **Action**: `create`
- **Base URL**: `https://api.luzmo.com` (EU), `https://api.us.luzmo.com` (US), or your VPC-specific API Host URL

## Request Parameters

### Available Parameters

- **dataset_id** (required): `string (uuid)` - ID of the dataset for which to generate a new chart.
- **type** (required): `"generate-chart" | "generate-example-questions"` - Type of AI recommendation.
- **question**: `string` - (Required for type `generate-chart`) User prompt to guide the recommendations.
- **message_history**: `array<string>` - Optional history of the conversation, not including the latest question.

## Required Access Rights

- Logged-in User

## SDK Usage

Luzmo provides official SDKs that handle authentication and request formatting automatically. You can also use any HTTP client (curl, fetch, axios, etc.) to make requests directly to the API.

### Shell / cURL

Base URL: `https://api.luzmo.com` (EU), `https://api.us.luzmo.com` (US), or your VPC-specific API Host URL

```bash
curl https://api.luzmo.com/0.1.0/aichart  -H "Content-Type: application/json" -d @- << EOF
{
  "action": "create",
  "version": "0.1.0",
  "key": "<your Luzmo API key>",
  "token": "<your Luzmo API token>",
  "properties": {
    "type": "generate-chart",
    "dataset_id": "<dataset ID>",
    "question": "Visualize burrito cheesyness by recipe"
  }
}
EOF
```

### Node SDK

Install: `npm install @luzmo/nodejs-sdk`

```javascript
import Luzmo from '@luzmo/nodejs-sdk';
const client = new Luzmo({
  api_key: '<your Luzmo API key>',
  api_token: '<your Luzmo API token>',
  host: '< https://api.luzmo.com (default) or https://api.us.luzmo.com or your VPC-specific address >'
});

const response = await client.create('aichart',
  {
    type: "generate-chart",
    dataset_id: "<dataset ID>",
    question: "Visualize burrito cheesyness by recipe"
  }
);
```

### Java SDK

Install: `pkg:maven/com.luzmo/sdk`

```java
Luzmo client = new Luzmo(
  "<your Luzmo API key>',
  "<your Luzmo API token>',
  "< https://api.luzmo.com (default) or https://api.us.luzmo.com or your VPC-specific address >"
);

JSONObject response = client.create("aichart",
  ImmutableMap.of(
    "type" , "generate-chart",
    "dataset_id" , "<dataset ID>",
    "question" , "Visualize burrito cheesyness by recipe"
  )
);
```

### .NET SDK

Install: `dotnet add package LuzmoSDK`

```csharp
Luzmo client = new Luzmo(
  "<your Luzmo API key>',
  "<your Luzmo API token>',
  "< https://api.luzmo.com (default) or https://api.us.luzmo.com or your VPC-specific address >"
);

dynamic properties = new ExpandoObject();
properties.type = "generate-chart";
properties.dataset_id = "<dataset ID>";
properties.question = "Visualize burrito cheesyness by recipe";

dynamic response = client.create("aichart", properties);

```

### Python SDK

Install: `pip install luzmo-sdk`

```python
from luzmo.luzmo import Luzmo
client = Luzmo(
  "<your Luzmo API key>',
  "<your Luzmo API token>',
  "< https://api.luzmo.com (default) or https://api.us.luzmo.com or your VPC-specific address >"
)

response = client.create("aichart",
  {
    "type": "generate-chart",
    "dataset_id": "<dataset ID>",
    "question": "Visualize burrito cheesyness by recipe"
  }
)
```

### PHP SDK

Install: `composer require luzmo/luzmo-sdk-php`

```php
<?php
require 'vendor/autoload.php';
use Luzmo\Luzmo;

$client = Luzmo::initialize(
  '<your Luzmo API key>',
  '<your Luzmo API token>',
  '< https://api.luzmo.com (default) or https://api.us.luzmo.com or your VPC-specific address >'
);

$response = $client->create("aichart",
  array (
    'type' => "generate-chart",
    'dataset_id' => "<dataset ID>",
    'question' => "Visualize burrito cheesyness by recipe"
  )
);
?>
```

## Request Body Examples

The following examples show the complete request body structure for HTTP/cURL requests. Each example includes the outer wrapper property (`properties`) that contains the actual parameters.

> **For SDKs**: Pass only the inner content (without the outer wrapper) to the SDK methods. For example, if the JSON shows `{ "properties": { "name": {"en": "My aichart"} } }`, an SDK would use something like this: `client.create('aichart', { name: { en: "My aichart" } })`.

### Generate a chart using a prompt

**Request properties:**

```json
{
  "properties": {
    "type": "generate-chart",
    "dataset_id": "<dataset ID>",
    "question": "Visualize burrito cheesyness by recipe"
  }
}
```

**Expected response for this request (HTTP 200)**

```json
{
  "generatedChart": {
    "type": "bar-chart",
    "position": {
      "sizeX": 24,
      "sizeY": 28,
      "row": 0,
      "col": 0
    },
    "title": {},
    "options": {
      "title": {
        "en": "Cheesyness by Recipe"
      }
    },
    "content": {},
    "slots": [
      {
        "name": "y-axis",
        "content": [
          {
            "type": "numeric",
            "format": ",.2f",
            "label": "cheesyness",
            "columnId": "99909a5d-aa8f-405b-8325-2d30b67af583",
            "datasetId": "d75f3d79-ae27-4007-8653-19b22db79bbd"
          }
        ]
      },
      {
        "name": "measure",
        "content": []
      },
      {
        "name": "legend",
        "content": [
          {
            "type": "hierarchy",
            "label": "recipe",
            "columnId": "ec281a85-7def-4603-819f-408835780aa9",
            "datasetId": "d75f3d79-ae27-4007-8653-19b22db79bbd"
          }
        ]
      }
    ],
    "aichartId": "303768d2-ff51-4e11-82c8-dffc8691ff48"
  },
  "question": "Visualize burrito cheesyness by recipe",
  "functionCall": "createBarChart",
  "functionResponse": {
    "title": "Cheesyness by Recipe",
    "s__y-axis": [
      {
        "id": "0"
      }
    ],
    "s__measure": [],
    "s__legend": [
      {
        "id": "10"
      }
    ]
  }
}
```

### Generate example prompts for a dataset containing information about burritos

**Request properties:**

```json
{
  "properties": {
    "dataset_id": "d75f3d79-ae27-4007-8653-19b22db79bbd",
    "type": "generate-example-questions"
  }
}
```

**Expected response for this request (HTTP 200)**

```json
{
  "examples": [
    {
      "title": "Cheesy Burrito Sales by Country",
      "chartType": "bar chart",
      "columnIds": [
        "0",
        "3"
      ]
    },
    {
      "title": "Monthly Sales Trend",
      "chartType": "line chart",
      "columnIds": [
        "8",
        "9"
      ]
    },
    {
      "title": "Deal of the Day Distribution",
      "chartType": "donut-chart",
      "columnIds": [
        "6"
      ]
    },
    {
      "title": "Shopkeeper Age Distribution",
      "chartType": "histogram",
      "columnIds": [
        "13"
      ]
    },
    {
      "title": "Vegetarian vs Non-Vegetarian Orders",
      "chartType": "pie chart",
      "columnIds": [
        "17"
      ]
    }
  ]
}
```

## Generic Response Formats

These responses are generic endpoint-level formats (for example common error payloads) and are not specific to one request example.

### A bad request error message returned by the API. (HTTP 400)

```json
{
  "type": {
    "code": 400,
    "description": "Bad Request"
  },
  "message": "Detailed error message"
}
```

### An internal server error message returned by the API. (HTTP 500)

```json
{
  "type": {
    "code": 500,
    "description": "Internal Server Error"
  },
  "message": "Detailed error message"
}
```



---

## Sitemap

- [Official best practices and implementation guidelines](https://developer.luzmo.com/AGENTS.md)
- [Overview of all docs pages](https://developer.luzmo.com/llms.txt)

