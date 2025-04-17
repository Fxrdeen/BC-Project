"use client";

import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { REAL_ESTATE_CONTRACT_ADDRESS } from "../constants";
import RealEstateBuy from "../../artifacts/contracts/RealEstateBuy.sol/RealEstateBuy.json";

export type Property = {
  propertyId: number;
  name: string;
  location: string;
  description: string;
  imageURI: string;
  totalCost: ethers.BigNumberish;
  totalNumberOfTokens: number;
  pricePerToken: ethers.BigNumberish;
  isActive: boolean;
};

// Add a new type for user properties that extends the base Property type
export type UserProperty = Property & {
  userTokens: number;
  investmentValue: number;
};

export function useBlockchain() {
  const [account, setAccount] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [propertyLoading, setPropertyLoading] = useState(false);
  const connectWallet = useCallback(async () => {
    if (
      typeof window !== "undefined" &&
      typeof window.ethereum !== "undefined"
    ) {
      try {
        // Request account access
        const accounts = await window.ethereum.request({
          method: "eth_requestAccounts",
        });
        setAccount(accounts[0]);
        setIsConnected(true);
        return true;
      } catch (error) {
        console.error("User denied account access", error);
        setError("Failed to connect wallet. User denied access.");
        return false;
      }
    } else {
      setError(
        "MetaMask is not installed. Please install MetaMask to use this feature."
      );
      return false;
    }
  }, []);

  const loadProperties = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Check if MetaMask is available
      if (
        typeof window === "undefined" ||
        typeof window.ethereum === "undefined"
      ) {
        setError("MetaMask is not installed");
        return;
      }

      // Initialize provider and contract
      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(
        REAL_ESTATE_CONTRACT_ADDRESS,
        RealEstateBuy.abi,
        provider
      );

      console.log("Fetching properties from blockchain...");

      try {
        // Get all properties from the contract
        const allProperties = await contract.getAllProperties();
        console.log("Raw properties data:", allProperties);

        // Convert and format properties
        const formattedProperties = [];

        // Loop through each property and add it to our array if it's valid
        for (let i = 0; i < allProperties.length; i++) {
          const prop = allProperties[i];

          // Skip any invalid properties (e.g., if they have an empty name)
          if (!prop || !prop.name) {
            console.log(`Skipping invalid property at index ${i}`);
            continue;
          }

          // Add each valid property to our array
          formattedProperties.push({
            propertyId: Number(prop.propertyId),
            name: prop.name,
            location: prop.location,
            description: prop.description,
            imageURI: prop.imageURI,
            totalCost: prop.totalCost,
            totalNumberOfTokens: Number(prop.totalNumberOfTokens),
            pricePerToken: prop.pricePerToken,
            isActive: prop.isActive,
          });
        }

        console.log("Formatted properties:", formattedProperties);

        // Don't set properties to empty array if length is 0
        // Instead, keep the previous properties and show an error
        if (formattedProperties.length === 0) {
          console.warn("No properties returned from blockchain");
          setError("No properties found on the blockchain");

          // Don't clear the properties array if it's already populated
          if (properties.length > 0) {
            console.log("Keeping existing properties in state");
            setLoading(false);
            return;
          }
        }

        // Update the state with new properties
        setProperties(formattedProperties);
      } catch (contractError: any) {
        console.error("Error calling contract:", contractError);

        // If we already have properties loaded, don't clear them on error
        if (properties.length > 0) {
          console.log("Error refreshing properties, keeping existing data");
          setError(
            "Error refreshing: " +
              (contractError.message || String(contractError))
          );
        } else {
          setError(
            "Error loading properties: " +
              (contractError.message || String(contractError))
          );
        }
      }
    } catch (error) {
      console.error("Unexpected error:", error);

      // Don't clear properties if we already have some
      if (properties.length > 0) {
        setError("Error refreshing data");
      } else {
        setError("Failed to load properties from blockchain");
      }
    } finally {
      setLoading(false);
    }
  }, [properties.length]); // Only reload when property count changes

  // Purchase tokens for a property
  const purchaseTokens = useCallback(
    async (propertyId: number, tokensToPurchase: number) => {
      if (!isConnected) {
        setError("Please connect your wallet first");
        return false;
      }

      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const contract = new ethers.Contract(
          REAL_ESTATE_CONTRACT_ADDRESS,
          RealEstateBuy.abi,
          signer
        );

        // Find the property to get its price
        const property = properties.find((p) => p.propertyId === propertyId);
        if (!property) throw new Error("Property not found");

        // Calculate total cost
        const tokenPrice = property.pricePerToken;
        const totalCost =
          ethers.toBigInt(tokenPrice) * ethers.toBigInt(tokensToPurchase);

        console.log("Purchasing with details:", {
          propertyId,
          tokensToPurchase,
          totalCost: totalCost.toString(),
          tokenPrice: tokenPrice.toString(),
        });

        // Execute the transaction
        const tx = await contract.purchasePropertyTokens(
          propertyId,
          tokensToPurchase,
          {
            value: totalCost,
          }
        );

        console.log("Transaction hash:", tx.hash);
        const receipt = await tx.wait();
        console.log("Transaction confirmed:", receipt);

        // Reload properties to get updated token counts
        await loadProperties();

        return true;
      } catch (error: any) {
        console.error("Purchase error:", error);

        if (error.reason) {
          setError(error.reason);
        } else if (error.message) {
          setError(error.message);
        } else {
          setError("Transaction failed");
        }

        return false;
      }
    },
    [isConnected, properties, loadProperties]
  );

  // Load properties when component mounts if MetaMask is available
  useEffect(() => {
    // Check if MetaMask is installed
    if (
      typeof window !== "undefined" &&
      typeof window.ethereum !== "undefined"
    ) {
      // Check if already connected
      window.ethereum
        .request({ method: "eth_accounts" })
        .then((accounts: string[]) => {
          if (accounts.length > 0) {
            setAccount(accounts[0]);
            setIsConnected(true);
            loadProperties();
          } else {
            setLoading(false);
          }
        })
        .catch((err: any) => {
          console.error(err);
          setLoading(false);
        });

      // Listen for account changes
      window.ethereum.on("accountsChanged", (accounts: string[]) => {
        if (accounts.length > 0) {
          setAccount(accounts[0]);
          setIsConnected(true);
          loadProperties();
        } else {
          setAccount(null);
          setIsConnected(false);
        }
      });
    } else {
      setLoading(false);
    }
  }, [loadProperties]);

  const getPropertyById = useCallback(async (id: number) => {
    if (
      typeof window !== "undefined" &&
      typeof window.ethereum !== "undefined"
    ) {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const contract = new ethers.Contract(
          REAL_ESTATE_CONTRACT_ADDRESS,
          RealEstateBuy.abi,
          provider
        );

        // First check if the property exists

        // Get the property details
        const property = await contract.getPropertyDetails(id);

        return {
          propertyId: Number(property.propertyId),
          name: property.name,
          location: property.location,
          description: property.description,
          imageURI: property.imageURI,
          totalCost: property.totalCost,
          totalNumberOfTokens: Number(property.totalNumberOfTokens),
          pricePerToken: property.pricePerToken,
          isActive: property.isActive,
        };
      } catch (error) {
        console.error("Error fetching property by ID:", error);
        throw new Error("Failed to load property details");
      }
    } else {
      throw new Error("MetaMask is not installed");
    }
  }, []);

  // Update the return type of getUserProperties
  const getUserProperties = useCallback(async (): Promise<UserProperty[]> => {
    if (!isConnected || !account) {
      setError("Please connect your wallet first");
      return [];
    }

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(
        REAL_ESTATE_CONTRACT_ADDRESS,
        RealEstateBuy.abi,
        provider
      );

      // Get all properties
      const allProperties = await contract.getAllProperties();
      console.log("All properties:", allProperties);
      const userProperties: UserProperty[] = [];

      // For each property, check if the user has tokens
      for (let i = 0; i < allProperties.length; i++) {
        const property = allProperties[i];
        const propertyId = Number(property.propertyId);
        try {
          // Call the getMyTokens function from the contract
          const tokenCount = await contract.getMyTokens(propertyId);

          // If user has tokens for this property, add it to the list
          if (Number(tokenCount) > 0) {
            // Calculate investment value correctly
            const pricePerToken = property.pricePerToken;
            const investmentValue =
              Number(ethers.formatEther(pricePerToken)) * Number(tokenCount);

            userProperties.push({
              propertyId: propertyId,
              name: property.name,
              location: property.location,
              description: property.description,
              imageURI: property.imageURI,
              totalCost: property.totalCost,
              totalNumberOfTokens: Number(property.totalNumberOfTokens),
              pricePerToken: property.pricePerToken,
              isActive: property.isActive,
              userTokens: Number(tokenCount),
              investmentValue: investmentValue,
            });
          }
        } catch (error) {
          console.error(
            `Error getting token count for property ${propertyId}:`,
            error
          );
        }
      }

      return userProperties;
    } catch (error) {
      console.error("Error getting user properties:", error);
      setError("Failed to load your investments");
      return [];
    }
  }, [isConnected, account]);

  return {
    account,
    isConnected,
    properties,
    loading,
    error,
    connectWallet,
    loadProperties,
    purchaseTokens,
    getPropertyById,
    getUserProperties,
  };
}

// Type declaration for window.ethereum
declare global {
  interface Window {
    ethereum: any;
  }
}
