# Rutile
Small project trying to figure out secure decentralised computing

The goal of the project is to execute different parts of JavaScript on different machines all done in the browser.
An application on Rabbit is being split in multiple chunks and executed on multiple machines to find the result.
Applications will be executed for a maximum of n seconds and then terminated. Applications that need longer execution can use wave points to save values. Rabbit continues right where the execution left off on another machine.

## How it works (draft)

Rabbit uses a secure version of eval to execute JavaScript applications on other machines. It spawns an iframe (with as URL a base64 string containing HTML) on the site and spins up an web worker. This way it has no access to other data on the website such as cookies and localStorage, and will also delete all data once the program is done executing.
Rabbit applications will then be executed with a set timeout. If it exceeds this timeout the rabbit application will be terminated and the processing power will be free'd. 

