/*!40101 SET NAMES utf8 */;

/*!40101 SET SQL_MODE=''*/;

/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;
CREATE DATABASE /*!32312 IF NOT EXISTS*/`cmdb` /*!40100 DEFAULT CHARACTER SET utf8 */;

USE `cmdb`;

/*Table structure for table `city` */

DROP TABLE IF EXISTS `city`;

CREATE TABLE `city` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) CHARACTER SET utf8 COLLATE utf8_bin NOT NULL,
  `short` varchar(3) CHARACTER SET utf8 COLLATE utf8_bin NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_cmdb_city_natural_key` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8;

/*Data for the table `city` */

insert  into `city`(`id`,`name`,`short`) values (1,'Amsterdam','AMS');
insert  into `city`(`id`,`name`,`short`) values (2,'Brussels','BRU');

/*Table structure for table `datacenter` */

DROP TABLE IF EXISTS `datacenter`;

CREATE TABLE `datacenter` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `city_id` int(11) NOT NULL,
  `name` varchar(255) CHARACTER SET utf8 COLLATE utf8_bin NOT NULL,
  `short` varchar(3) CHARACTER SET utf8 COLLATE utf8_bin NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_cmdb_datacenter_natural_key` (`city_id`,`name`),
  CONSTRAINT `fk_cmdb_datacenter_city_id` FOREIGN KEY (`city_id`) REFERENCES `city` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=323833 DEFAULT CHARSET=utf8;

/*Data for the table `datacenter` */

insert  into `datacenter`(`id`,`city_id`,`name`,`short`) values (1,1,'AMS North','AMS'),(2,1,'AMS South','AMS'),(3,2,'BRU West','AMS'),(4,2,'BRU East','AMS');

/*Table structure for table `resource` */

DROP TABLE IF EXISTS `resource`;

CREATE TABLE `resource` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `datacenter_id` int(11) NOT NULL,
  `name` varchar(255) CHARACTER SET utf8 COLLATE utf8_bin NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_cmdb_resource_natural_key` (`name`,`datacenter_id`),
  KEY `fk_cmdb_resource_datacenter_id` (`datacenter_id`),
  CONSTRAINT `fk_cmdb_resource_datacenter_id` FOREIGN KEY (`datacenter_id`) REFERENCES `datacenter` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=331761 DEFAULT CHARSET=utf8;

/*Data for the table `resource` */

insert  into `resource`(`id`,`datacenter_id`,`name`) values (1,1,'Rack AM North 1'),(2,1,'Rack AM North 2'),(3,2,'Rack AM South 1'),(4,2,'Rack AM South 2'),(5,3,'Rack BRU West 1'),(6,3,'Rack BRU West 2'),(7,4,'Rack BRU East 1'),(8,4,'Rack BRU East 2');


/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;
