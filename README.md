# SLSP Card - Alma Cloud App
<a href="https://developers.exlibrisgroup.com/appcenter/slsp-card/">![CloudApp Activations](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fapps01.ext.exlibrisgroup.com%2Fappstats.json&query=%24%5B%3F(%40.cloud_app_id%3D%3D'swiss-library-service-platform%2Fslsp-card-cloud-app')%5D.user_count&style=flat&label=Cloud%20App%20Activations)</a>
<a href="https://developers.exlibrisgroup.com/appcenter/slsp-card/">![CloudApp Activations](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fapps01.ext.exlibrisgroup.com%2Fappstats.json&query=%24%5B%3F(%40.cloud_app_id%3D%3D'swiss-library-service-platform%2Fslsp-card-cloud-app')%5D.institution_count&style=flat&label=Cloud%20App%20Institutions)</a>


## Overview

This repository contains the [Alma Cloud App](https://developers.exlibrisgroup.com/cloudapps/) for Swisscovery Library Card Management from [SLSP](https://slsp.ch/).

Manage account settings on the network level by managing blocks, the preferred address and the library card numbers of a user.

This Alma Cloud App is a product for SLSP libraries.

## Requirements

In order to use this app

- your institution must be a member of the SLSP network zone.
- your institution must be unlocked by SLSP in order to use this service.
- your Alma user has to contain at least of one these user roles:
    - Fulfillment Services Manager
    - User Manager
    - General System Administrator

tex
## Daily Use

Start Screen of the app:

<img src=./preview/welcome.png alt="drawing" width="300"/>

Navigate to a Alma page with user entities. 
This can either be a user list with several entities or a user detail page. 

<img src=./preview/userlist.png alt="drawing" width="300"/>

Select the user you want manage.

### Library Card Numbers
<img src=./preview/app1.png alt="drawing" width="300"/>

### Settings (preferred address)
<img src=./preview/app2.png alt="drawing" width="300"/>

### Blocks
<img src=./preview/app3.png alt="drawing" width="300"/>

## Missing permissions

If you receive an error message "Unfortunately your institution does not have the permission to use this app.", please [contact SLSP](https://slsp.ch/en/contact) to unlock your institution for the service.

## Issues and defects
Please use the GitHub "Issues" of this repository to report any defects. We will have a look into it as soon as possible.

## Licence 

[GNU Genereal Public Licence v3.0](https://github.com/Swiss-Library-Service-Platform/slsp-card-cloud-app/blob/main/LICENCE)