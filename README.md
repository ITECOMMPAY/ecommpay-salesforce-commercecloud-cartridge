# Ecommpay SalesForce Commerce Cloud (B2C) integration

Tested with SFRA version 6.0 - 6.3

## Integration guide

In order to process payments with actual debiting of funds, you should initially solve all organisational issues related to the interaction with ecommpay ([submit the application](https://ecommpay.com/apply-now/) for connecting to the payment platform, provide all necessary information, and receive a notification from ecommpay about the possibility to process payments, as well as the identifier and secret key of the production project). Along with that, it is necessary to provide the ecommpay technical support specialists with the name and URL of the web service for which the plug-in from ecommpay is set up and the currency in which payments are to be processed.

### Preparations

1. First, you need to follow the steps to authorize
 in [GitHub SF SSO](https://github.com/orgs/SalesforceCommerceCloud/sso),
 and download and unzip the release
 of [SFRA version 6](https://github.com/SalesforceCommerceCloud/storefront-reference-architecture/releases) (you need permissions to view
 this repository, you can get
 instruction [here](https://trailhead.salesforce.com/content/learn/modules/b2c-developer-resources-and-tools/b2c-developer-access-repositories)).
2. Second, download and unzip the latest release of [Ecommpay Integration](https://github.com/ITECOMMPAY)

### Installation

1. Install [node.js version 16 LTS](https://nodejs.org/en/download).
2. Run `npm install --global yarn`
3. Run this commands in **SFRA** folder: `yarn install`; `yarn build`
4. Copy all cartridges from **SFRA/cartridges** folder, and paste them into **Ecommpay Integration/cartridges** folder.
5. Run this commands sequentially in **Ecommpay Integration** folder: `yarn install`; `yarn build`

Result:
<pre>
📦ecommpay_integration
 ┣ 📂cartridges
 ┃ ┣ 📂app_storefront_base
 ┃ ┣ 📂bm_app_storefront_base
 ┃ ┣ 📂bm_ecommpay
 ┃ ┣ 📂int_ecommpay_core
 ┃ ┣ 📂int_ecommpay_sfra
 ┃ ┗ 📂modules
 ┗ 📂ecp_meta
 ┃ ┣ 📂meta
 ┃ ┗ 📂sites
 ┃   ┗ 📂My_Site_ID
 ┗ 📜package.json
</pre>

### Upload cartridges

1. Create your ```dw.json``` file in **Ecommpay Integration**.
 You
 can find
 examples of
 file
 here: ```dw.json.example```.
 And also you can read
 [documentation](https://developer.salesforce.com/docs/commerce/sfra/guide/b2c-build-sfra.html#upload-code-for-sfra)
 about this file.
2. Run `yarn uploadCartridge` command in **Ecommpay Integration** folder.
 If your credentials are correct, the
 cartridges will be successfully uploaded to the SalesForce.
3. Go to **Administration > Site Development > Code Deployment** and activate a version which is specified in **dw.json**

### Setup website

1. Add the following line of cartridges: `int_ecommpay_sfra:int_ecommpay_core:app_storefront_base` for your site in
 section **Administration > Sites > Manage Sites > [Your website] > Settings tab > cartridges field**.
Click **Apply** button.
2. Add the following line of cartridges: `bm_ecommpay:int_ecommpay_core:bm_app_storefront_base` for BM in section **Administration >
 Sites > Manage Sites > Business Manager - Settings**.  Click **Apply** button.

### Import metadata

1. Open **ecp_meta > sites** folder.
Rename the **RefArchGlobal** to the **Website ID** of the site you want to install
   the integration on. You can find your **Website ID** in **Administration > Sites > Manage Sites**.
2. Open **Ecommpay Integration** folder.
3. Run ```yarn zipMetadata```.
4. Upload the Zip file you just created in section **Administration > Site Development > Site Import & Export**.
5. Press **Import** and **OK** on uploaded file.

### Add Ecommpay settings and credentials

Update **Merchant Tools > Site Preferences > Custom Site Preferences > Ecommpay Config** with site-specific values:

* Enable - Activate payment gateway Ecommpay. If this setting is disabled, then all payment methods with Ecommpay processors will not be used on the checkout page.

* Project ID - Your project ID you could get from Ecommpay helpdesk. Leave it blank if test mode.

* Secret Key - project key for interacting with the platform. You could get it from Ecommpay helpdesk.

* Ecommpay card display mode - the ability to open a payment form with a card method.

You can choose from the following options:

* Redirect — opening as a separate HTML page;

* Embedded — opening in an iframe element


Enable payment methods

In the Business Manager, go to **Merchant Tools > Ordering > Payment methods**. Select "Yes" in the "Enabled" column for all supported methods in your project Ecommpay.

### Check result

Now your integration should work. Check your storefront shop payments.
