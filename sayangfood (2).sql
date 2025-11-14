-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Nov 13, 2025 at 06:24 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `sayangfood`
--

-- --------------------------------------------------------

--
-- Table structure for table `donation`
--

CREATE TABLE `donation` (
  `donation_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `item_id` int(11) NOT NULL,
  `donation_date` datetime NOT NULL,
  `pickup_location` varchar(50) NOT NULL,
  `donation_status` varchar(20) NOT NULL,
  `donation_remark` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `donation`
--

INSERT INTO `donation` (`donation_id`, `user_id`, `item_id`, `donation_date`, `pickup_location`, `donation_status`, `donation_remark`) VALUES
(3, 52, 15, '2025-10-14 00:00:00', 'Help Uni Main Entrance', 'Available', ''),
(4, 52, 19, '2025-10-14 00:00:00', 'Dk Impian', 'Donated', ''),
(5, 52, 20, '2025-10-14 00:00:00', 'Dk Impian', 'Donated', ''),
(6, 52, 14, '2025-10-14 00:00:00', 'Help Uni Main Entrance', 'Available', ''),
(8, 52, 23, '2025-10-14 00:00:00', 'Help Uni Main Entrance', 'Donated', 'today'),
(9, 52, 26, '2025-10-15 00:00:00', 'Help Uni Main Entrance', 'Available', 'only morning session');

-- --------------------------------------------------------

--
-- Table structure for table `food_item_inventory`
--

CREATE TABLE `food_item_inventory` (
  `item_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `item_name` varchar(30) NOT NULL,
  `item_category` varchar(15) NOT NULL,
  `quantity` varchar(20) NOT NULL,
  `expiry_date` date NOT NULL,
  `item_status` varchar(20) NOT NULL,
  `storage_place` varchar(20) NOT NULL,
  `item_remark` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `food_item_inventory`
--

INSERT INTO `food_item_inventory` (`item_id`, `user_id`, `item_name`, `item_category`, `quantity`, `expiry_date`, `item_status`, `storage_place`, `item_remark`) VALUES
(2, 42, 'Chicken breast', 'Meat', '1 kg', '2025-10-17', 'Used', 'Freezer', ''),
(10, 52, 'Salmon Fish', 'Seafood', '500 g', '2025-10-29', 'Expired', 'Freezer', 'For Dinner'),
(11, 52, 'Luncheon Meat (Chicken)', 'Meat', '1 Can', '2025-12-15', 'Available', 'Cabinet', ''),
(12, 52, 'Milk', 'Dairy', '1 litres', '2025-10-22', 'Expired', 'Refrigerator', 'For Breakfast'),
(13, 52, 'Jasmine Rice', 'Grains', '5 kg', '2025-11-26', 'Available', 'Storage Box', ''),
(14, 52, 'Broccoli', 'Vegetable', '200 g', '2025-10-20', 'Donated', 'Refrigerator', 'Finish it as soon  as possible'),
(15, 52, 'Carrot', 'Vegetable', '1 packs', '2025-10-21', 'Donated', 'Refrigerator', ''),
(16, 52, 'Soy Source', 'Condiment', '750 ml', '2025-11-19', 'Available', 'Pantry', ''),
(17, 52, 'Orange Juice', 'Beverage', '950 ml', '2025-11-26', 'Used', 'Refrigerator', ''),
(18, 52, 'Cookies', 'Snacks', '1 packs', '2025-10-13', 'Expired', 'Storage Box', ''),
(19, 52, 'Potato', 'Vegetable', '2 kg', '2025-10-30', 'Donated', 'Storage Box', ''),
(20, 52, 'Ginger', 'Vegetable', '500 g', '2025-10-26', 'Donated', 'Storage Box', ''),
(21, 52, 'Tuna', 'Seafood', '1 Can', '2025-12-17', 'Planned for Meal', 'Cabinet', ''),
(22, 52, 'Tomato', 'Vegetable', '5 pcs', '2025-10-25', 'Expired', 'Refrigerator', ''),
(23, 52, 'Strawberries', 'Fruit', '300 g', '2025-10-16', 'Donated', 'Refrigerator', ''),
(24, 52, 'Cheese', 'Dairy', '1 packs', '2025-10-13', 'Expired', 'Refrigerator', ''),
(26, 52, 'Chicken Drumstick', 'Meat', '3 pcs', '2025-10-22', 'Donated', 'Freezer', ''),
(27, 52, 'Chicken Drumstick', 'Meat', '3 kg', '2025-10-31', 'Expired', 'Refrigerator', 'dinner today');

-- --------------------------------------------------------

--
-- Table structure for table `meal_plan`
--

CREATE TABLE `meal_plan` (
  `meal_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `item_id` int(11) NOT NULL,
  `meal_name` varchar(30) NOT NULL,
  `meal_slot` varchar(10) NOT NULL,
  `meal_date` datetime NOT NULL,
  `meal_status` varchar(20) NOT NULL,
  `meal_remark` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `notification`
--

CREATE TABLE `notification` (
  `notification_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `notification_type` varchar(20) NOT NULL,
  `message` varchar(255) NOT NULL,
  `notification_status` tinyint(1) NOT NULL,
  `timestamp` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `user_id` int(11) NOT NULL,
  `user_name` varchar(30) NOT NULL,
  `email` varchar(30) NOT NULL,
  `user_password` varchar(255) DEFAULT NULL,
  `address` varchar(50) NOT NULL,
  `gender` varchar(6) NOT NULL,
  `age` int(11) NOT NULL,
  `phone_num` int(11) NOT NULL,
  `is_public` tinyint(1) NOT NULL,
  `verification_code` varchar(6) DEFAULT NULL,
  `is_verified` tinyint(1) NOT NULL DEFAULT 0,
  `household_size` int(11) DEFAULT NULL,
  `two_factor_enabled` tinyint(1) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`user_id`, `user_name`, `email`, `user_password`, `address`, `gender`, `age`, `phone_num`, `is_public`, `verification_code`, `is_verified`, `household_size`, `two_factor_enabled`) VALUES
(42, 'juanmao', 'jylee2911@hotmail.com', 'jy12345', '', '', 0, 0, 0, NULL, 1, NULL, 1),
(52, 'xinyou', 'pxypxy12@gmail.com', 'pxy12345', '', '', 0, 0, 0, NULL, 1, NULL, 1),
(95, 'John', 'b2201031@helplive.edu.my', 'John1234567', '', '', 0, 0, 0, NULL, 1, 2, 1);

--
-- Indexes for dumped tables
--

--
-- Indexes for table `donation`
--
ALTER TABLE `donation`
  ADD PRIMARY KEY (`donation_id`),
  ADD KEY `fk_donation_user` (`user_id`),
  ADD KEY `fk_donation_item` (`item_id`);

--
-- Indexes for table `food_item_inventory`
--
ALTER TABLE `food_item_inventory`
  ADD PRIMARY KEY (`item_id`),
  ADD KEY `fk_fooditem_user` (`user_id`);

--
-- Indexes for table `meal_plan`
--
ALTER TABLE `meal_plan`
  ADD PRIMARY KEY (`meal_id`),
  ADD KEY `fk_mealplan_user` (`user_id`),
  ADD KEY `fk_mealplan_item` (`item_id`);

--
-- Indexes for table `notification`
--
ALTER TABLE `notification`
  ADD PRIMARY KEY (`notification_id`),
  ADD KEY `fk_notification_user` (`user_id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`user_id`),
  ADD UNIQUE KEY `user_name` (`user_name`),
  ADD UNIQUE KEY `eamil` (`email`),
  ADD UNIQUE KEY `user_password` (`user_password`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `donation`
--
ALTER TABLE `donation`
  MODIFY `donation_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT for table `food_item_inventory`
--
ALTER TABLE `food_item_inventory`
  MODIFY `item_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=28;

--
-- AUTO_INCREMENT for table `meal_plan`
--
ALTER TABLE `meal_plan`
  MODIFY `meal_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `notification`
--
ALTER TABLE `notification`
  MODIFY `notification_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `user_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=96;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `donation`
--
ALTER TABLE `donation`
  ADD CONSTRAINT `fk_donation_item` FOREIGN KEY (`item_id`) REFERENCES `food_item_inventory` (`item_id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_donation_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `food_item_inventory`
--
ALTER TABLE `food_item_inventory`
  ADD CONSTRAINT `fk_fooditem_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `meal_plan`
--
ALTER TABLE `meal_plan`
  ADD CONSTRAINT `fk_mealplan_item` FOREIGN KEY (`item_id`) REFERENCES `food_item_inventory` (`item_id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_mealplan_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `notification`
--
ALTER TABLE `notification`
  ADD CONSTRAINT `fk_notification_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
