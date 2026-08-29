ALTER TABLE `shoppingItems` ADD `sharedItemId` varchar(32);--> statement-breakpoint
UPDATE `shoppingItems` SET `sharedItemId` = `id` WHERE `sharedItemId` IS NULL;--> statement-breakpoint
CREATE INDEX `shoppingItems_shared_idx` ON `shoppingItems` (`sharedItemId`);
