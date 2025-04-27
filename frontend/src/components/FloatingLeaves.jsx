import React from "react";
import "./FloatingLeaves.css";
import leafImg from "../assets/leaf.png";

const FloatingLeaves = () => {
  const leaves = Array.from({ length: 10 });

  return (
    <>
      {leaves.map((_, index) => {
        const left =  Math.floor(Math.random() * 100); // evenly spaced
        const delay = index * 1;   // small consistent stagger

        return (
          <div
            key={index}
            className="leaf"
            style={{
              left: `${left}%`,
              animation: `fall 15s linear ${delay}s infinite`,
              backgroundImage: `url(${leafImg})`,
            }}
          />
        );
      })}
    </>
  );
};

export default FloatingLeaves;
