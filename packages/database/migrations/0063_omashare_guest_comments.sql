ALTER TABLE `comments` MODIFY COLUMN `authorId` varchar(15);--> statement-breakpoint
ALTER TABLE `comments` ADD `guestName` varchar(80);