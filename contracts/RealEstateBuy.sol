// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

contract RealEstateBuy {
    struct Property {
        uint256 propertyId;
        string name;
        string location;
        string description;
        string imageURI;
        uint256 totalCost;
        uint256 totalNumberOfTokens;
        uint256 pricePerToken;
        bool isActive;
    }
    Property[] public propertiesList;

    // Track token ownership per user
    mapping(uint256 => mapping(address => uint256)) public tokenOwnership;
    
    event PropertyCreated(uint256 indexed propertyId, string name, string location, string description, string imageURI, uint256 totalSupply, uint256 totalNumberOfTokens, uint256 pricePerToken);
    event PropertyPurchased(uint256 indexed propertyId, address indexed buyer, uint256 amount);
    event PropertySold(uint256 indexed propertyId, address indexed buyer, uint256 amount);
    event PropertyUpdated(uint256 indexed propertyId, string name, string location, string description, string imageURI, uint256 totalSupply, uint256 totalNumberOfTokens, uint256 pricePerToken);
    
    constructor() {}

    function createProperty(string memory name, string memory location, string memory description, string memory imageURI, uint256 totalCost, uint256 totalNumberOfTokens, uint256 pricePerToken) public {
        uint256 propertyCount = propertiesList.length;
        propertiesList.push(Property(propertyCount, name, location, description, imageURI, totalCost, totalNumberOfTokens, pricePerToken, true));
        emit PropertyCreated(propertyCount, name, location, description, imageURI, totalCost, totalNumberOfTokens, pricePerToken);
    }

    function purchasePropertyTokens(uint256 propertyId, uint256 tokensToPurchase) public payable {
        Property storage property = propertiesList[propertyId];
        require(property.isActive, "Property is not active");
        require(tokensToPurchase > 0, "Amount must be greater than 0");
        require(tokensToPurchase <= property.totalNumberOfTokens, "Not enough tokens available");
        
        uint256 expectedValue = tokensToPurchase * property.pricePerToken;
        require(msg.value == expectedValue, "Incorrect amount sent");

        // Update available tokens
        property.totalNumberOfTokens -= tokensToPurchase;
        
        // Track token ownership
        tokenOwnership[propertyId][msg.sender] += tokensToPurchase;
        
        emit PropertyPurchased(propertyId, msg.sender, tokensToPurchase);
    }

    function sellPropertyTokens(uint256 propertyId, uint256 amount) public {
        Property storage property = propertiesList[propertyId];
        require(property.isActive, "Property is not active");
        require(amount > 0, "Amount must be greater than 0");
        
        // Check if user owns enough tokens
        require(tokenOwnership[propertyId][msg.sender] >= amount, "You don't own enough tokens");

        // Update token ownership
        tokenOwnership[propertyId][msg.sender] -= amount;
        
        // Update property
        property.totalNumberOfTokens += amount;

        // Transfer ETH to seller
        uint256 saleValue = amount * property.pricePerToken;
        payable(msg.sender).transfer(saleValue);
        
        emit PropertySold(propertyId, msg.sender, amount);
    }

    function getPropertyDetails(uint256 propertyId) public view returns (string memory name, string memory location, string memory description, string memory imageURI, uint256 totalCost, uint256 totalNumberOfTokens, uint256 pricePerToken, bool isActive) {
        Property storage property = propertiesList[propertyId];
        return (property.name, property.location, property.description, property.imageURI, property.totalCost, property.totalNumberOfTokens, property.pricePerToken, property.isActive);
    }

    function getAllProperties() public view returns (Property[] memory) {
        Property[] memory properties = new Property[](propertiesList.length);
        for (uint256 i = 0; i < propertiesList.length; i++) {
            properties[i] = propertiesList[i];
        }
        return properties;
    }
    
    function getMyTokens(uint256 propertyId) public view returns (uint256) {
        return tokenOwnership[propertyId][msg.sender];
    }
}