# YLidar-Chataigne-Module-main
Chataigne Module for YLidar (only tested with G2) based on serial communication protocol. /!\ BETA version, use at your own risks, for test purposes only.

It generates a point3D cloud of 360 polar and XY coordinates structured as the following :

Polar coordinates : [angle, distance, intensity]
XY coordinates : [X,Y,intensity]

It generates also a XY and a polar Point3D based on the same structuration but exposing a value after another from 0 to 359. It can be used to create live 2D maps by exctracting coordinates for example. The speed can be adjusted by changing "update rate" parameter.

For more information on the product, check https://www.ydlidar.com/product/ydlidar-g2 and https://dedjh0j7jhutx.cloudfront.net/2036899223840006144/0a0bd6eb3b832ab36a363b58ed00b952.pdf

For more information on the protocol, check : https://github.com/YDLIDAR/YDLidar-SDK/blob/master/doc/YDLidar-SDK-Communication-Protocol.md


